import type { SessionView } from '../domain/session';
import { recoveryReport, escape as e } from './report';
import { improvements } from './analysis';
import { unconfirmedRecovery } from './team';

export function teamReport(view: SessionView): string {
  if (!view.sharedPlan) throw new Error('No shared map is available.');
  const plan = view.sharedPlan,
    lost = view.lostIds ?? [];
  const changes = improvements(plan, lost);
  const confirmations = unconfirmedRecovery(plan, view.analysis).map((method) => {
    const account = plan.assets.find((a) => a.id === method.accountId)!;
    return `<li><b>Confirm recovery for ${e(account.label)}</b> — ${e(account.owner || plan.owner || 'Account owner')}: ${e(method.label)}. Confirm the actual procedure and record its outcome in the private plan.</li>`;
  });
  const extra = `<h2>Team check — simulated results</h2><p>Room ${e(view.id)} · ${e(view.phase)}. Recorded actions describe a simulation; they do not establish that a provider account was recovered or a recovery method was tested.</p><table><thead><tr><th>Work</th><th>At this point in the simulation</th></tr></thead><tbody>${view.analysis.targets.map((t) => `<tr><td>${e(t.label)}</td><td>${t.current ? 'Available' : t.reachable ? 'Recorded recovery route remains' : 'No confirmed route'}</td></tr>`).join('')}</tbody></table>${confirmations.length ? `<h2>Methods to confirm first</h2><ul>${confirmations.join('')}</ul>` : ''}<h2>Other changes to consider</h2>${changes.length ? `<ul>${changes.map((c) => `<li><b>${e(c.title)}</b> — ${c.gain} additional activities could become recoverable.<ul>${c.addedAssumptions.map((a) => `<li>${e(a)}</li>`).join('')}</ul></li>`).join('')}</ul>` : '<p>Confirm the recorded methods with their owners and document their actual test outcomes in your private plan.</p>'}<h2>Team timeline</h2><ol>${view.events.map((event) => `<li>${e(event.at)} · ${e(event.actor)}<br>${e(event.label)}</li>`).join('')}</ol>`;
  return recoveryReport(plan, lost).replace('</header>', `</header>${extra}<h2>Original map — forecast before recorded actions</h2>`);
}
