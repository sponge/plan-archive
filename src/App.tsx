import { For, ResourceFetcher, createMemo, createResource, createSignal, type Component } from 'solid-js';

import './App.css';

type PlanIndex = Record<string, PlanFile[]>;
type UserByDomainEntries = [string, string[]][];

interface PlanFile {
  by: string
  time: string
  contents: string
}

const App: Component = () => {

  const fetchPlans: ResourceFetcher<true, PlanIndex, unknown> = async () => {
    const resp = await fetch('/plan-archive/plans.json');
    return resp.json();
  }
  const [plans] = createResource(fetchPlans, { initialValue: {} });

  const domains = createMemo(() => Object.keys(plans())
    .map(u => u.split('@')[1])
    .filter((value, i, array) => array.indexOf(value) == i)
    .sort((a, b) => a.localeCompare(b))
  );

  const users = createMemo(() => Object.keys(plans()).sort((a, b) => a.localeCompare(b)));

  const usersByDomain = createMemo<UserByDomainEntries>(() => domains()
    .map(domain => [
      domain,
      users()
        .filter(user => user.endsWith(domain))
        .map(user => user.replace('@' + domain, ''))
    ])
  );

  const [currentUser, setCurrentUser] = createSignal<string>('');
  const [searchTerm, setSearchTerm] = createSignal<string>('');

  const filteredPlans = createMemo(() => {
    if (!currentUser().length && !searchTerm().length) return [];
    const isUser = currentUser().includes('@');
    return Object.entries(plans())
      .filter(plan => isUser ? plan[0] == currentUser() : plan[0].includes(currentUser()))
      .map(plan => plan[1])
      .flat()
      // FIXME: half-assed text search. look into fuse.js
      .filter(plan => plan.contents.toLowerCase().includes(searchTerm().toLowerCase()))
      .sort((a, b) => a.time.localeCompare(b.time));
  })

  // bit of a hack, shouldn't touch the dom like this
  const setPlansVisible = (show: boolean) => {
    document.querySelectorAll('.plans details')
      .forEach(dom => { if (dom instanceof HTMLDetailsElement) dom.open = show })
  }

  return (
    <main class="container">
      <aside>
        <nav>
          <h2>Users</h2>
          <For each={usersByDomain()} fallback={<article aria-busy="true"></article>}>
            {domain => <details>
              <summary>{domain[0]}</summary>
              <ul>
                <li><a href='#' onClick={[setCurrentUser, domain[0]]}>All</a></li>
                <For each={domain[1]}>
                  {user => <li><a href='#' onClick={[setCurrentUser, `${user}@${domain[0]}`]}>{user}</a></li>}
                </For>
              </ul>
            </details>}
          </For>
        </nav>
      </aside>

      <main class="plans">
        <nav>
          <ul>
            <li><strong>{filteredPlans().length} plans</strong></li>
          </ul>
          <ul>
            <li><input type="search" placeholder="Search" onInput={val => setSearchTerm(val.target.value)} /></li>
            <li><a href="#" onClick={[setPlansVisible, true]}>open all</a></li>
            <li><a href="#" onClick={[setPlansVisible, false]}>close all</a></li>
          </ul>
        </nav>
        <For each={filteredPlans()}>
          {plan => <details open>
            <summary>{plan.by} - {plan.time}</summary>
            <article>{plan.contents}</article>
          </details>}
        </For>
      </main>
    </main>
  );
};

export default App;
