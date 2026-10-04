import { ArrowRight, Plus } from 'lucide-react';
import type { Plan } from '../../../packages/planner/model';
import { PlanMap } from './PlanMap';
export function PlanOverview({
  plan,
  onEdit,
  onCheck,
  onAdd,
}: {
  plan: Plan;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onCheck: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DEPENDENCIES</span>
          <h1>{plan.name}</h1>
          <p>Select a service to see what it needs.</p>
        </div>
        <div className="button-row">
          <button className="button" onClick={onAdd}>
            <Plus size={16} />
            Add a service
          </button>
          <button className="button primary" onClick={onCheck}>
            Try a blackout
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
      <PlanMap key={plan.id} plan={plan} onEdit={onEdit} />
    </>
  );
}
