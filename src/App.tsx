import { For, Match, ResourceFetcher, Show, Suspense, Switch, createMemo, createResource, createSignal, type Component } from 'solid-js';

import './App.css';
import linkifyStr from 'linkify-string';

type UserByDomainEntries = [string, string[]][];

interface PlanFile {
  by: string
  time: number
  contents: string
}

const App: Component = () => {

  const fetchPlans: ResourceFetcher<true, PlanFile[], unknown> = async () => {
    const resp = await fetch('/plan-archive/plans.json');
    return resp.json();
  }

  const [plans] = createResource(fetchPlans, { initialValue: [] });

  const domains = createMemo(() => plans()
    .map(plan => plan.by.split('@')[1])
    .filter((value, i, array) => array.indexOf(value) == i)
    .sort((a, b) => a.localeCompare(b))
  );

  const users = createMemo(() => plans()
    .map(plan => plan.by)
    .filter((by, i, array) => array.indexOf(by) == i)
    .sort((a, b) => a.localeCompare(b))
  );

  const usersByDomain = createMemo<UserByDomainEntries>(() => domains()
    .map(domain => [
      domain,
      users()
        .filter(user => user.endsWith('@' + domain))
        .map(user => user.replace('@' + domain, ''))
    ])
  );

  const [currentUser, setCurrentUser] = createSignal<string>('');
  const [searchTerm, setSearchTerm] = createSignal<string>('');

  const filteredPlans = createMemo(() => {
    if (!currentUser().length && !searchTerm().length) return [];
    const isUser = currentUser().includes('@');
    return plans()
      .filter(plan => isUser ? plan.by == currentUser() : plan.by.endsWith(currentUser()))
      // FIXME: half-assed text search. look into fuse.js
      .filter(plan => plan.contents.toLowerCase().includes(searchTerm().toLowerCase()))
      .sort((a, b) => a.time - b.time);
  })

  // bit of a hack, shouldn't touch the dom like this
  const setPlansVisible = (show: boolean) => {
    document.querySelectorAll('.plans details')
      .forEach(dom => { if (dom instanceof HTMLDetailsElement) dom.open = show })
  }

  return (
    <main class="container">
      <Suspense fallback={<span aria-busy="true"></span>}>
        <aside>
          <nav>
            <h2>Users</h2>
            <For each={usersByDomain()}>
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
              <li>
                <strong>
                  <Show when={currentUser().length || searchTerm().length}
                    fallback={`${plans().length} total plans`}>
                    {filteredPlans().length} plans
                  </Show>
                </strong>
              </li>
            </ul>
            <ul>
              <li><a href="#" onClick={[setPlansVisible, true]}>open all</a></li>
              <li><a href="#" onClick={[setPlansVisible, false]}>close all</a></li>
              <li><input type="search" placeholder="Search" onInput={val => setSearchTerm(val.target.value)} /></li>
            </ul>
          </nav>
          <For each={filteredPlans()}>
            {plan => <PlanReader plan={plan} />}
          </For>
        </main>
      </Suspense>
    </main>
  );
};

interface PlanReaderProps {
  plan: PlanFile
}

const PlanReader: Component<PlanReaderProps> = props => {
  const contentsWithLinks = () => {
    const date = new Date(props.plan.time * 1000);
    const waybackTime = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}000000`
    const baseURL = `https://web.archive.org/web/${waybackTime}/`;
    return linkifyStr(props.plan.contents, {
      target: '_blank',
      formatHref: (href) => baseURL + href,
      validate: { email: false },
    });
  };

  return <details open>
    <summary>{props.plan.by} - {new Date(props.plan.time * 1000).toDateString()}</summary>
    <article innerHTML={contentsWithLinks()} />
  </details>
}

export default App;
