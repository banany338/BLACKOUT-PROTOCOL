import { checkPlan, explainRoute } from './analysis';
import type { Plan } from './model';

export const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function recoveryReport(
  plan: Plan,
  lostIds: string[],
  createdAt = new Date().toISOString(),
): string {
  const { blueprint, analysis } = checkPlan(plan, lostIds),
    e = escape;
  const sections = analysis.targets
    .map((t) => {
      const route = explainRoute(t.fact, analysis, blueprint);
      return `<section><h3>${e(t.label)}</h3><p>${t.current ? 'Available under the declared conditions.' : t.reachable ? 'A recovery route exists in the documented model.' : t.uncertain ? 'Potential method needs confirmation; it is not counted as a working route.' : 'No recovery route found with the recorded methods and prerequisites.'}</p>${route.length ? `<ol>${route.map((r) => `<li><b>${e(r.label)}</b><br>Requires all: ${r.requires.map(e).join(', ')}<br>Evidence: ${e(r.evidence)}<br>${e(r.note)}</li>`).join('')}</ol>` : ''}</section>`;
    })
    .join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${e(plan.name)} — recovery plan</title><style>
  *{box-sizing:border-box}body{font:15px/1.6 system-ui,sans-serif;color:#202b2b;max-width:940px;margin:40px auto;padding:0 28px}header{border-top:6px solid #c94d38;padding-top:22px}h1{font-size:38px;line-height:1.12;letter-spacing:-1px}h2{margin-top:38px;padding-top:18px;border-top:1px solid #ced5d1}h3{margin-top:26px}small{color:#566260}.summary{background:#eef1ed;padding:22px;border-radius:6px}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;border-bottom:1px solid #d5dcd7;padding:10px;overflow-wrap:anywhere}li{margin:8px 0}section{break-inside:avoid}.counts{font-size:24px;font-weight:700}@media(max-width:600px){body{padding:0 16px}h1{font-size:30px}th,td{padding:8px;font-size:13px}}@media print{body{margin:0;padding:0;font-size:10pt}h1{font-size:27pt}h2,h3{break-after:avoid}tr,li{break-inside:avoid}.summary{border:1px solid #aaa}}
  </style></head><body><header><small>BLACKOUT PROTOCOL / OFFLINE RECOVERY REFERENCE</small><h1>${e(plan.name)}</h1><p>Version ${plan.version} · ${plan.proposed ? 'Proposed arrangements' : 'Owner-declared arrangements'} · Exported ${e(createdAt.slice(0, 10))}</p><p>Plan owner: ${e(plan.owner || 'Assign an owner')}<br>Last updated: ${e(plan.updatedAt.slice(0, 10))}</p></header>
  <div class="summary"><strong>${e(analysis.failure.label)}</strong><p>${e(analysis.failure.description)}</p><p class="counts">${analysis.targets.filter((t) => t.reachable).length} / ${analysis.targets.length} activities have a modelled route</p><p>${analysis.targets.filter((t) => t.current).length} available under these conditions · ${analysis.targets.filter((t) => t.uncertain).length} need more information</p></div>
  <h2>How to use this plan</h2><p>Confirm your provider's procedure before acting. These routes are based on recorded dependencies and evidence; they are not a guarantee of account recovery. After suspected compromise, use a trusted device and the provider's incident-response procedure to restore trust, revoke unauthorised sessions and review recovery settings.</p><p>This document contains organisational metadata. Keep it with authorised people. Review it for secrets before sharing. It needs no application or network connection to read.</p>
  <h2>Routes for essential activities</h2>${sections}<h2>Resources and ownership</h2><table><thead><tr><th>Resource / owner</th><th>Access requirements / notes</th></tr></thead><tbody>${plan.assets.map((a) => `<tr><td>${e(a.label)}<br><small>${e(a.owner || plan.owner || 'Unassigned')}</small></td><td>${a.requiresAll.length ? a.requiresAll.map((id) => e(plan.assets.find((x) => x.id === id)!.label)).join(' + ') : 'No access dependency recorded'}<br>${e(a.note)}</td></tr>`).join('')}</tbody></table>
  <h2>Recovery methods to confirm</h2><table><thead><tr><th>Method</th><th>Evidence / source</th></tr></thead><tbody>${plan.methods.map((m) => `<tr><td>${e(m.label)}<br>For ${e(plan.assets.find((a) => a.id === m.accountId)!.label)}</td><td>${e(m.evidence)} · ${e(m.reviewedAt || 'No review date')}<br>${e(m.note)}</td></tr>`).join('')}</tbody></table>
  <h2>Follow-up actions</h2>${plan.tasks.length ? `<ul>${plan.tasks.map((t) => `<li><b>${e(t.title)}</b><br>${e(t.owner || 'Unassigned')} · ${e(t.status)} · ${e(t.reviewDate || 'Review date not set')}<br>${e(t.note)}</li>`).join('')}</ul>` : '<p>Assign an owner to each missing or unconfirmed method, then record its procedure and test outcome.</p>'}
  <h2>Source and limits</h2><p>${e(plan.source)}</p><ul>${blueprint.assumptions.map((a) => `<li>${e(a)}</li>`).join('')}</ul><h2>Next review</h2><p>Date: __________________ Owner: __________________</p><p>Outcome: __________________________________________________________</p></body></html>`;
}
