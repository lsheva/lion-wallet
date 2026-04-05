import {
  type Component,
  children,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  type ParentProps,
} from "solid-js";
import { Dynamic } from "solid-js/web";

function hashPath(): string {
  return window.location.hash.slice(1) || "/";
}

const [path, setPath] = createSignal(hashPath());
const [navState, setNavState] = createSignal<unknown>(null);

export function navigate(to: string, opts?: { replace?: boolean; state?: unknown }): void {
  setNavState(opts?.state ?? null);
  if (opts?.replace) {
    history.replaceState(null, "", `#${to}`);
  } else {
    location.hash = to;
  }
  setPath(to);
}

export function useNavigate(): typeof navigate {
  return navigate;
}

/** Read the state passed via the most recent `navigate()` call. */
export function useNavState<T = unknown>(): T | null {
  return navState() as T | null;
}

interface RouteDef {
  path: string;
  component: Component;
}

/** Declarative route definition — returns data for HashRouter to consume. */
export function Route(props: RouteDef): JSX.Element {
  return { path: props.path, component: props.component } as unknown as JSX.Element;
}

export function HashRouter(props: {
  root?: Component<ParentProps>;
  children?: unknown;
}): JSX.Element {
  /** Solid may pass `children` as a function; reading `props.children` alone yields no routes. */
  const resolved = children(() => props.children as JSX.Element);

  onMount(() => {
    const onHashChange = () => setPath(hashPath());
    window.addEventListener("hashchange", onHashChange);
    onCleanup(() => window.removeEventListener("hashchange", onHashChange));
  });

  const content = () => {
    const defs: RouteDef[] = [];
    for (const item of resolved.toArray()) {
      if (
        item != null &&
        typeof item === "object" &&
        "path" in item &&
        "component" in item &&
        typeof (item as RouteDef).path === "string"
      ) {
        defs.push(item as RouteDef);
      }
    }
    const routeMap: Record<string, Component> = {};
    let fallback: Component | undefined;
    for (const d of defs) {
      if (d.path === "*") fallback = d.component;
      else routeMap[d.path] = d.component;
    }
    const comp = routeMap[path()] ?? fallback;
    if (!comp) return undefined;
    return <Dynamic component={comp} />;
  };

  return props.root ? <Dynamic component={props.root}>{content()}</Dynamic> : content();
}
