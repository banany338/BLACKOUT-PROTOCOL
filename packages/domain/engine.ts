import type { Analysis, Blueprint, Closure, Evidence, Failure, Rule, Witness } from './model';

const rank: Record<Evidence, number> = {
  fixture: 0,
  'user-marked-tested': 1,
  'user-reported': 2,
  unknown: 3,
};
export function closure(
  initial: string[],
  rules: Rule[],
  actions = true,
  maximumEvidence = 2,
): Closure {
  const facts = new Set(initial);
  const witness: Record<string, Witness> = {};
  const weights: Record<string, number> = Object.fromEntries(initial.map((f) => [f, 0]));
  const allowed = rules
    .filter(
      (r) => r.enabled && (actions || r.kind === 'derived') && rank[r.evidence] <= maximumEvidence,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of allowed) {
      if (!rule.requiresAll.every((f) => facts.has(f))) continue;
      const quality = Math.max(
        rank[rule.evidence],
        ...rule.requiresAll.map((f) => weights[f] ?? 0),
      );
      for (const fact of rule.grants)
        if (!facts.has(fact) || quality < weights[fact]) {
          facts.add(fact);
          weights[fact] = quality;
          witness[fact] = {
            ruleId: rule.id,
            prerequisites: [...rule.requiresAll],
            evidence: (Object.keys(rank) as Evidence[]).find((e) => rank[e] === quality)!,
          };
          changed = true;
        }
    }
  }
  return { facts, witness };
}

export function dependencyCycles(rules: Rule[]): string[][] {
  const graph = new Map<string, Set<string>>();
  for (const rule of rules.filter((r) => r.enabled))
    for (const source of rule.requiresAll)
      for (const target of rule.grants) {
        if (!graph.has(source)) graph.set(source, new Set());
        graph.get(source)!.add(target);
        if (!graph.has(target)) graph.set(target, new Set());
      }
  let index = 0;
  const indices = new Map<string, number>(),
    low = new Map<string, number>(),
    onStack = new Set<string>(),
    stack: string[] = [],
    result: string[][] = [];
  function visit(v: string) {
    indices.set(v, index);
    low.set(v, index++);
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!indices.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, indices.get(w)!));
    }
    if (low.get(v) === indices.get(v)) {
      const group: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        group.push(w);
      } while (w !== v);
      if (group.length > 1 || graph.get(v)?.has(v)) result.push(group.sort());
    }
  }
  for (const v of [...graph.keys()].sort()) if (!indices.has(v)) visit(v);
  return result;
}

export function applyFailure(initial: string[], failure: Failure): string[] {
  return [...new Set([...initial.filter((f) => !failure.removes.includes(f)), ...failure.adds])];
}
export function analyze(blueprint: Blueprint, failure: Failure, actualFacts?: string[]): Analysis {
  const initial = actualFacts ?? applyFailure(blueprint.initialFacts, failure);
  const rules = blueprint.rules.filter((r) => !failure.disabledRules.includes(r.id));
  const current = closure(initial, rules, false);
  const forecast = closure(initial, rules);
  const confirmed = closure(initial, rules, true, 1);
  const possible = closure(initial, rules, true, 3);
  const cycles = dependencyCycles(rules).filter(
    (group) =>
      group.some((f) => !forecast.facts.has(f)) && !group.some((f) => current.facts.has(f)),
  );
  return {
    failure,
    current: [...current.facts].sort(),
    reachable: [...forecast.facts].sort(),
    confirmed: [...confirmed.facts].sort(),
    possible: [...possible.facts].sort(),
    witness: forecast.witness,
    cycles,
    resources: blueprint.resources.map((r) => ({
      id: r.id,
      canRecover: forecast.facts.has(r.fact),
      state: current.facts.has(r.fact)
        ? 'available'
        : failure.compromised.includes(r.id)
          ? 'compromised'
          : forecast.facts.has(r.fact)
            ? 'recoverable'
            : possible.facts.has(r.fact)
              ? 'uncertain'
              : 'blocked',
    })),
    targets: blueprint.targets.map((t) => ({
      ...t,
      current: current.facts.has(t.fact),
      reachable: forecast.facts.has(t.fact),
      confirmed: confirmed.facts.has(t.fact),
      uncertain: !forecast.facts.has(t.fact) && possible.facts.has(t.fact),
    })),
  };
}

export function routeTo(fact: string, analysis: Analysis, blueprint: Blueprint): Rule[] {
  const seen = new Set<string>(),
    result: Rule[] = [];
  function visit(f: string) {
    if (seen.has(f) || analysis.current.includes(f)) return;
    seen.add(f);
    const witness = analysis.witness[f];
    if (!witness) return;
    witness.prerequisites.forEach(visit);
    const rule = blueprint.rules.find((r) => r.id === witness.ruleId);
    if (rule && !result.some((r) => r.id === rule.id)) result.push(rule);
  }
  visit(fact);
  return result;
}

export function blockersFor(fact: string, analysis: Analysis, blueprint: Blueprint) {
  return blueprint.rules
    .filter((r) => r.grants.includes(fact))
    .map((r) => ({
      rule: r,
      missing: r.requiresAll.filter((f) => !analysis.current.includes(f)),
      availableInForecast: r.enabled && r.requiresAll.every((f) => analysis.reachable.includes(f)),
    }));
}
export function factLabel(fact: string, b: Blueprint): string {
  const labels: Record<string, string> = {
    'work.control': 'Control of work identity',
    'work.credentials-rotated': 'Credentials rotated',
    'work.sessions-revoked': 'Sessions revoked',
    'work.recovery-settings-reviewed': 'Recovery settings reviewed',
    'kit.prepared': 'Independent kit prepared',
    'communications.available': 'Usable communication route',
    'kit.not-configured': 'Kit preparation outstanding',
  };
  return b.resources.find((r) => r.fact === fact)?.label ?? labels[fact] ?? fact;
}
