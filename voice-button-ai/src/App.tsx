import { useEffect, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { WorkflowScreen } from './components/WorkflowScreen';
import { Home } from './pages/Home';
import { Workflows } from './pages/Workflows';
import { Favorites } from './pages/Favorites';
import { Settings } from './pages/Settings';
import { useApp } from './store';
import type { Workflow } from './types/workflow';

interface ActiveWorkflow {
  workflow: Workflow;
  initialInputs?: Record<string, string>;
}

function greetingForNow(): string {
  const h = new Date().getHours();
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  return `Good ${part} — what do you want to do?`;
}

export default function App() {
  const { touchWorkflow } = useApp();
  const [tab, setTab] = useState<Tab>('home');
  const [active, setActive] = useState<ActiveWorkflow | null>(null);
  const [greeting] = useState(greetingForNow);

  const open = (workflow: Workflow, initialInputs?: Record<string, string>) => {
    touchWorkflow(workflow.id);
    setActive({ workflow, initialInputs });
  };
  const close = () => setActive(null);

  // Close the workflow overlay with Escape.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-950 text-zinc-100">
      <main className="flex-1">
        {tab === 'home' && <Home onOpen={open} greeting={greeting} />}
        {tab === 'workflows' && <Workflows onOpen={open} />}
        {tab === 'favorites' && <Favorites onOpen={open} />}
        {tab === 'settings' && <Settings />}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      {active && (
        <WorkflowScreen
          workflow={active.workflow}
          initialInputs={active.initialInputs}
          onClose={close}
        />
      )}
    </div>
  );
}
