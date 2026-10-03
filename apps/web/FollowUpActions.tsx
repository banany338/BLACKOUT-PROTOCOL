import { useState } from 'react';
import { Check } from 'lucide-react';
import { blueprintSchema, type Blueprint } from '../../packages/domain/model';
import { readinessTasks } from '../../packages/domain/readiness';

export function FollowUpActions({
  blueprint,
  onSave,
}: {
  blueprint: Blueprint;
  onSave: (b: Blueprint) => void;
}) {
  const [tasks, setTasks] = useState(() => structuredClone(readinessTasks(blueprint)));
  const [dirty, setDirty] = useState(false);
  function update(index: number, field: string, value: string) {
    setTasks((previous) =>
      previous.map((task, i) => (i === index ? { ...task, [field]: value } : task)),
    );
    setDirty(true);
  }
  return (
    <section className="panel follow-up-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">TURN THE FINDING INTO A TASK</span>
          <h2>Before the next blackout.</h2>
        </div>
        <span className="tag">
          {tasks.filter((t) => t.status === 'tested').length} / {tasks.length} marked tested
        </span>
      </div>
      <p className="muted">
        Track who will make each arrangement real. Status is recorded by your team; it does not
        automatically change the recovery forecast.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            blueprintSchema.parse({
              ...blueprint,
              version: blueprint.version + 1,
              followUps: tasks,
            }),
          );
        }}
      >
        <div className="follow-up-list">
          {tasks.map((task, i) => (
            <fieldset key={task.id}>
              <legend>
                {String(i + 1).padStart(2, '0')} / {task.title}
              </legend>
              <div className="follow-up-fields">
                <label>
                  Owner
                  <input
                    aria-label={`Owner: ${task.title}`}
                    maxLength={100}
                    value={task.owner}
                    onChange={(e) => update(i, 'owner', e.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select
                    aria-label={`Status: ${task.title}`}
                    value={task.status}
                    onChange={(e) => update(i, 'status', e.target.value)}
                  >
                    <option value="proposed">Proposed</option>
                    <option value="implemented">Marked implemented</option>
                    <option value="tested">Marked tested</option>
                  </select>
                </label>
                <label>
                  Review date
                  <input
                    aria-label={`Review date: ${task.title}`}
                    type="date"
                    value={task.reviewDate}
                    onChange={(e) => update(i, 'reviewDate', e.target.value)}
                  />
                </label>
              </div>
              <label>
                Outcome or source note
                <input
                  aria-label={`Note: ${task.title}`}
                  maxLength={1000}
                  placeholder="What was checked, and what still needs work?"
                  value={task.note}
                  onChange={(e) => update(i, 'note', e.target.value)}
                />
              </label>
            </fieldset>
          ))}
        </div>
        <button className="button primary" disabled={!dirty}>
          <Check size={16} />
          Save follow-up actions
        </button>
      </form>
    </section>
  );
}
