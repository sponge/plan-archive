import { For, ResourceFetcher, Suspense, createEffect, createMemo, createResource, createSignal, type Component } from 'solid-js';

import './App.css';

type PlanIndex = Record<string, PlanFile[]>;

interface PlanFile {
  by: string
  time: string
  contents: string
}

const App: Component = () => {

  const fetchPlans: ResourceFetcher<true, PlanIndex, unknown> = async () => {
    const resp = await fetch('/plans.json');
    return resp.json();
  }

  const [plans] = createResource(fetchPlans, { initialValue: {} });

  const domains = createMemo(() => Object.keys(plans())
    .map(u => u.split('@')[1])
    .filter((value, i, array) => array.indexOf(value) == i)
    .sort((a, b) => a.localeCompare(b))
  );

  const users = createMemo(() => Object.keys(plans()).sort((a, b) => a.localeCompare(b)));

  const [currentUser, setCurrentUser] = createSignal<string>('');

  const filteredPlans = createMemo(() => {
    if (!currentUser().length) return [];
    const isUser = currentUser().includes('@');
    return Object.entries(plans())
      .filter(plan => isUser ? plan[0] == currentUser() : plan[0].includes(currentUser()))
      .map(plan => plan[1])
      .flat()
      .sort((a, b) => a.time.localeCompare(b.time));
  })

  return (
    <main class="container">
      <aside>
        <nav>
          <h2>Domains</h2>
          <ul>
            <For each={domains()} fallback={<article aria-busy="true"></article>}>
              {domain => <li><a href='#' onClick={[setCurrentUser, domain]}>{domain}</a></li>}
            </For>
          </ul>

          <h2>Users</h2>
          <ul>
            <For each={users()} fallback={<article aria-busy="true"></article>}>
              {user => <li><a href='#' onClick={[setCurrentUser, user]}>{user}</a></li>}
            </For>
          </ul>
        </nav>
      </aside>

      <main class="plans">
        <For each={filteredPlans()}>
          {plan => <article>{plan.contents}</article>}
        </For>
      </main>
    </main>
  );
};

export default App;
