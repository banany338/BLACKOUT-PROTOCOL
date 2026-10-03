import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Blueprint, ViewerRole } from '../../packages/domain/model';
import {
  DomainError,
  newSession,
  reduceCommand,
  type Command,
  type Participant,
  type Session,
} from '../../packages/domain/session';
import { observations } from './scenario';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const makeId = () => randomBytes(9).toString('hex');
type MemberRow = {
  id: string;
  session_id: string;
  name: string;
  role: ViewerRole;
  token_hash: string;
};
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS blueprints (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS participants (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), name TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS commands (session_id TEXT NOT NULL REFERENCES sessions(id), action_id TEXT NOT NULL, actor_id TEXT NOT NULL, revision INTEGER NOT NULL, command_json TEXT NOT NULL, PRIMARY KEY(session_id, action_id));
      CREATE TABLE IF NOT EXISTS events (session_id TEXT NOT NULL REFERENCES sessions(id), sequence INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(session_id, sequence));`);
  }
  close() {
    this.db.close();
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  saveBlueprint(b: Blueprint) {
    const id = makeId();
    this.db.prepare('INSERT INTO blueprints VALUES (?, ?)').run(id, JSON.stringify(b));
    return id;
  }
  getBlueprint(id: string): Blueprint {
    const row = this.db.prepare('SELECT json FROM blueprints WHERE id = ?').get(id) as
      { json: string } | undefined;
    if (!row) throw new DomainError('Blueprint not found.', 404);
    return JSON.parse(row.json);
  }
  getSession(id: string): Session {
    const row = this.db.prepare('SELECT json FROM sessions WHERE id = ?').get(id) as
      { json: string } | undefined;
    if (!row) throw new DomainError('Exercise not found.', 404);
    return JSON.parse(row.json);
  }
  saveSession(s: Session) {
    this.db.prepare('UPDATE sessions SET json = ? WHERE id = ?').run(JSON.stringify(s), s.id);
    for (const event of s.events)
      this.db
        .prepare('INSERT OR IGNORE INTO events VALUES (?, ?, ?)')
        .run(s.id, event.sequence, JSON.stringify(event));
  }
  create(blueprint: Blueprint, name: string) {
    return this.transaction(() => {
      const id = makeId(),
        session = newSession(id, blueprint);
      this.db.prepare('INSERT INTO sessions VALUES (?, ?)').run(id, JSON.stringify(session));
      return { id, ...this.addParticipant(id, name, 'facilitator') };
    });
  }
  addParticipant(id: string, name: string, role: ViewerRole = 'pending') {
    const s = this.getSession(id);
    if (s.phase === 'completed')
      throw new DomainError('This exercise has ended. Ask the facilitator to start another run.');
    if (this.participants(id).length >= 30) throw new DomainError('This demo room is full.');
    const participant: Participant = { id: makeId(), name, role };
    const token = randomBytes(32).toString('hex');
    this.db
      .prepare('INSERT INTO participants VALUES (?, ?, ?, ?, ?)')
      .run(participant.id, id, name, role, digest(token));
    return { participant, token };
  }
  member(id: string, token?: string): Participant {
    if (!token) throw new DomainError('Join this exercise to continue.', 401);
    const row = this.db
      .prepare('SELECT * FROM participants WHERE session_id = ? AND token_hash = ?')
      .get(id, digest(token)) as MemberRow | undefined;
    if (!row) throw new DomainError('Your room credential is invalid.', 401);
    return { id: row.id, name: row.name, role: row.role };
  }
  participants(id: string): Participant[] {
    return this.db
      .prepare('SELECT id, name, role FROM participants WHERE session_id = ? ORDER BY rowid')
      .all(id) as Participant[];
  }
  assign(id: string, actor: Participant, participantId: string, role: ViewerRole) {
    if (actor.role !== 'facilitator')
      throw new DomainError('Only the facilitator can assign roles.', 403);
    if (role === 'facilitator')
      throw new DomainError('Facilitator access cannot be assigned here.', 403);
    this.transaction(() => {
      const target = this.participants(id).find((p) => p.id === participantId);
      if (!target || target.role === 'facilitator')
        throw new DomainError('Participant not found.', 404);
      if (
        !['observer', 'pending'].includes(role) &&
        this.participants(id).some((p) => p.role === role && p.id !== participantId)
      )
        throw new DomainError('That role is already assigned.');
      this.db
        .prepare('UPDATE participants SET role = ? WHERE id = ? AND session_id = ?')
        .run(role, participantId, id);
    });
  }
  actionResult(id: string, actionId: string, actor: Participant) {
    const row = this.db
      .prepare('SELECT revision, actor_id FROM commands WHERE session_id = ? AND action_id = ?')
      .get(id, actionId) as { revision: number; actor_id: string } | undefined;
    if (row && row.actor_id !== actor.id)
      throw new DomainError('This action belongs to another participant.', 403);
    return row ? { accepted: true, revision: row.revision } : { accepted: false };
  }
  command(id: string, actor: Participant, command: Command) {
    return this.transaction(() => {
      const existing = this.db
        .prepare(
          'SELECT revision, actor_id, command_json FROM commands WHERE session_id = ? AND action_id = ?',
        )
        .get(id, command.id) as
        { revision: number; actor_id: string; command_json: string } | undefined;
      if (existing) {
        if (existing.actor_id !== actor.id || existing.command_json !== JSON.stringify(command))
          throw new DomainError('Action ID has already been used.', 409);
        return { accepted: true, revision: existing.revision, duplicate: true };
      }
      // Resolve authority again inside the transaction, even when caller cached a member.
      const currentActor = this.participants(id).find((p) => p.id === actor.id);
      if (!currentActor) throw new DomainError('Participant not found.', 403);
      const next = reduceCommand(this.getSession(id), currentActor, command, observations);
      this.saveSession(next);
      this.db
        .prepare('INSERT INTO commands VALUES (?, ?, ?, ?, ?)')
        .run(id, command.id, actor.id, next.revision, JSON.stringify(command));
      return { accepted: true, revision: next.revision, duplicate: false };
    });
  }
}
