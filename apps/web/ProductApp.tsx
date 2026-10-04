import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Workspace } from './planner/Workspace';
const Practice = lazy(() => import('./Practice').then((module) => ({ default: module.Practice })));
const practicePath = () => /^\/(practice|room|join)(\/|$)/.test(location.pathname);

export function ProductApp() {
  const [practice, setPractice] = useState(practicePath);
  useEffect(() => {
    const changed = () => setPractice(practicePath());
    addEventListener('popstate', changed);
    return () => removeEventListener('popstate', changed);
  }, []);
  function navigate(next: boolean) {
    if (location.protocol !== 'file:') history.pushState({}, '', next ? '/practice' : '/');
    setPractice(next);
    window.scrollTo(0, 0);
  }
  return (
    <WorkspaceBoundary>
      {practice ? (
        <Suspense fallback={<div className="app-loading">Opening team practice…</div>}>
          <Practice onExit={() => navigate(false)} />
        </Suspense>
      ) : (
        <Workspace
          onPractice={() => navigate(true)}
          onTeamRoom={(id) => {
            history.pushState({}, '', `/room/${id}`);
            setPractice(true);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </WorkspaceBoundary>
  );
}

class WorkspaceBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="app-loading">
        <h1>Workspace could not open.</h1>
        <p>
          Your saved data has not been removed. Use a browser that allows local storage, then reload
          this page.
        </p>
        <button className="button" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
