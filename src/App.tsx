import './App.css';

import { For, Match, ResourceFetcher, Show, Suspense, Switch, createEffect, createMemo, createResource, createSignal, type Component } from 'solid-js';
import _ from 'lodash';
import linkifyStr from 'linkify-string';
import { Change, diffLines } from 'diff';

type UserByDomainEntries = [string, string[]][];

// this is what comes from the browser response
interface PlanFile {
  by: string
  time: number
  contents: string
}

// the plan reader wants diffs, but for the sake of splitting up code lets make
// this a different type
interface DisplayPlan extends PlanFile {
  diffs: Change[]
  largest: string
}


enum DisplayType {
  Trimmed = 'trimmed',  // the largest chunk of new text for people who post new on top
  Full = 'full',        // the whole thing
  Diff = 'diff'         // show a line by line highlighted diff
}

const App: Component = () => {
  const [currentUser, setCurrentUser] = createSignal<string>(''); // current user (or company)
  const [searchTerm, setSearchTerm] = createSignal<string>(''); // search body for this term
  const [displayType, setDisplayType] = createSignal<DisplayType>(DisplayType.Full); // how you want to view the plans
  const [showHelp, setShowHelp] = createSignal(false); // show the help text

  // grab the static plans file
  const fetchPlans: ResourceFetcher<true, PlanFile[], unknown> = async () => {
    const resp = await fetch('/plan-archive/plans.json');
    let plans: PlanFile[] = await resp.json();
    // sort by time here so we can depend on this in any further operations
    plans = plans.map(plan => { return {...plan, contents: plan.contents.trim()}})
    return plans.sort((a, b) => a.time - b.time);
  }
  const [plans] = createResource(fetchPlans, { initialValue: [] });

  // list of all domains that plans have came from
  const domains = createMemo(() => plans()
    .map(plan => plan.by.split('@')[1])
    .filter((value, i, array) => array.indexOf(value) == i)
    .sort((a, b) => a.localeCompare(b))
  );

  // list of all users
  // FIXME: store the full email so we can do stuff like collapse mail.ravensoft.com/ravensoft.com into one?
  const users = createMemo(() => plans()
    .map(plan => plan.by)
    .filter((by, i, array) => array.indexOf(by) == i)
    .sort((a, b) => a.localeCompare(b))
  );

  // map of each domain and all of the users, without domain
  const usersByDomain = createMemo<UserByDomainEntries>(() => domains()
    .map(domain => [
      domain,
      users()
        .filter(user => user.endsWith('@' + domain))
        .map(user => user.replace('@' + domain, ''))
    ])
  );

  // map of all plans by a specific user
  const plansByUser = createMemo(() => _.groupBy(plans(), 'by'));

  // all plans that are currently in the user's requested filters
  const filteredPlans = createMemo(() => {
    if (!currentUser().length && !searchTerm().length) return [];
    const isUser = currentUser().includes('@');
    return plans()
      .filter(plan => isUser ? plan.by == currentUser() : plan.by.endsWith(currentUser()))
      // FIXME: half-assed text search. look into fuse.js
      .filter(plan => plan.contents.toLowerCase().includes(searchTerm().toLowerCase()))
      .sort((a, b) => a.time - b.time);
  })

  // for all plans in the current view, find the current plan and the previous plan
  // posted by that same user, and diff them for the various display modes
  const filteredDisplayPlan = createMemo(() => filteredPlans().map(plan => {
    let diffs: Change[] = [];
    let largest = '';

    // find the post this user made before this one, default to empty string so diff works
    // minor optimization: don't bother doing this if you don't need it
    if (displayType() != DisplayType.Full) {
      const prevIdx = plansByUser()[plan.by].findIndex(test => test === plan) - 1;
      const prevStr = plansByUser()[plan.by][prevIdx]?.contents ?? '';
      diffs = diffLines(prevStr, plan.contents, { ignoreWhitespace: true });

      // filter out additions, however if it's empty (plans are identical) just use the whole array
      let additions = diffs.filter(d => d.added);
      if (!additions.length) additions = diffs;
      largest = additions.map(diff => diff.value).join('\n').trim();
    }

    return {
      ...plan,
      diffs,
      largest
    };
  }));

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
            <p class="help"><a href="#" onClick={[setShowHelp, true]}>what is this?</a></p>
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
                    {filteredDisplayPlan().length} plans
                  </Show>
                </strong>
              </li>
            </ul>
            <ul>
              <li><a href="#" onClick={[setPlansVisible, true]}>open all</a></li>
              <li><a href="#" onClick={[setPlansVisible, false]}>close all</a></li>
              <li>
                <select onChange={ev => setDisplayType(ev.target.value as DisplayType)} value={displayType()}>
                  <option value={DisplayType.Trimmed}>trimmed</option>
                  <option value={DisplayType.Full}>full</option>
                  <option value={DisplayType.Diff}>diff</option>
                </select>
              </li>
              <li><input type="search" placeholder="Search" onChange={ev => setSearchTerm(ev.target.value)} /></li>
            </ul>
          </nav>
          <For each={filteredDisplayPlan()}>
            {plan => <PlanReader displayType={displayType()} plan={plan} />}
          </For>
        </main>
      </Suspense>

      <dialog open={showHelp()} onClick={[setShowHelp, false]}>
        <article>
          <header>
            {/* @ts-expect-error its wrong! */}
            <button rel="prev" onClick={[setShowHelp, false]} />
            <p>
              <strong>The .plan Archive</strong>
            </p>
          </header>
          <p>Created by <a href="https://erysdren.me/">erysden</a> and <a href="https://d8d.org">sponge</a></p>
          <h2>What is this?</h2>
          <p>
            These things called .plan files are the name for a file that users, often on a Unix system, would write in order to tell
            others what they were doing, where they were, or anything at all. They were served through
            the <a href="https://en.wikipedia.org/wiki/Finger_(protocol)">Finger protocol</a> to other users on
            the early Internet. If you knew someone's username and what server they were on, you could see what
            that person was working on, where they were located, or anything else they thought useful. Widespread
            expansion of the Internet, and eventually the World Wide Web would render Finger largely obsolete by the
            early 90s.
          </p>
          <p>
            For some reason, however, id Software would begin distributing updates and news about their games
            through this protocol. Then, around 1996, John Carmack would start posting his work logs to his .plan file,
            and eventually sharing his thoughts on hardware, programming, id's upcoming games, and more. Even more
            inexplicably, other developers would follow Carmack's lead, and start publishing their own .plan files.
            Despite the existence of web browsers, this creaky old protocol that was used to spread one of the first
            Internet worms in the 1980s would become the primary source for what was going on inside PC gaming among
            early home Internet users.
          </p>
          <p> 
            Because the Finger protocol existed outside of the Web, these updates were largely inaccessible
            to most users who were not running shell accounts on Unix systems. Enterprising fans and early game
            journalists would take this as an opportunity to create websites that would track developers and
            give you up to the minute feeds on the latest posts. Demos were released, new features were talked
            about, and games going gold and getting ready to be distributed were all announced through these
            loosely connected systems.
          </p>
          <p>
            These posts were written by the developers themselves, and were first-hand accounts of their work
            and their games, but also their personal lives. Nowadays, we would just call these "blogs." For
            better or for worse, late 90s game development news and drama unfolded in these .plan files. Many
            of them read like personal journals, even though multiple sites had sprung up around covering them.
            Game developer beefs about competing games, combined with an immature industry filled with lots
            of unnecessary aggression led to plenty of regrettable statements being made through .plan files.
          </p>
          <p>
            Despite claims to the contrary, the internet does forget. Often, it forgets very easily.
            The transient nature of Finger meant that there is largely no record of these updates. Once the
            user changed the file or deleted the old content, it was gone for good. Websites would track previous
            updates, but over 25 years later, only one site that tracked these updates is still online: the
            venerable <a href="https://www.bluesnews.com">Blue's News</a>.
          </p>
          <p>
            Because the Wayback Machine's coverage of pre-2000s websites tends to be spotty, these updates
            are split across a lot of long-gone gaming sites, with most links leading to dead-ends. This
            archive is an attempt to consolidate everything that remains, make it readable in a chronological
            format, and provide some enhancements to the reading experience. With thousands of .plan files so far,
            and an unknown amount of thousands that have been lost for good, there will likely always be
            large gaps in availability. However, we think what's here currently provides a unique insight
            to a very fast-moving point in PC gaming history. At minimum, it is at least an entertaining look
            back at a time of the "rockstar gamedev" era.
          </p>
        </article>
      </dialog>
    </main>
  );
};

interface PlanReaderProps {
  displayType: DisplayType
  plan: DisplayPlan
}

const PlanReader: Component<PlanReaderProps> = props => {
  const contentsWithLinks = () => {
    const date = new Date(props.plan.time * 1000);
    const waybackTime = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}000000`
    const baseURL = `https://web.archive.org/web/${waybackTime}/`;
    return linkifyStr(props.displayType == DisplayType.Full ? props.plan.contents : props.plan.largest, {
      target: '_blank',
      formatHref: (href) => baseURL + href,
      validate: { email: false },
    });
  };

  return <details open>
    <summary>{props.plan.by} - {new Date(props.plan.time * 1000).toDateString()}</summary>
    <Switch>
      <Match when={props.displayType == DisplayType.Diff}>
        <article>
          <For each={props.plan.diffs}>{diff =>
            <div classList={{ 'added': diff.added, 'removed': diff.removed }}>{diff.value}</div>
          }</For>
        </article>
      </Match>
      <Match when={true}>
        <article innerHTML={contentsWithLinks()} />
      </Match>
    </Switch>
  </details>
}

export default App;
