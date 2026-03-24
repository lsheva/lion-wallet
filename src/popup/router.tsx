import { type Component, type JSX, type ParentProps, createSignal } from "solid-js";
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
  component: Component<any>;
}

/** Declarative route definition — returns data for HashRouter to consume. */
export function Route(props: RouteDef): JSX.Element {
  return { path: props.path, component: props.component } as unknown as JSX.Element;
}

export function HashRouter(props: {
  root?: Component<ParentProps>;
  children?: unknown;
}): JSX.Element {
  window.addEventListener("hashchange", () => setPath(hashPath()));

  const raw = props.children;
  const defs = (Array.isArray(raw) ? raw : [raw]) as RouteDef[];
  const routeMap: Record<string, Component<any>> = {};
  let fallback: Component<any> | undefined;
  for (const d of defs) {
    if (d.path === "*") fallback = d.component;
    else routeMap[d.path] = d.component;
  }

  const content = () => {
    const comp = routeMap[path()] ?? fallback;
    if (!comp) return undefined;
    return <Dynamic component={comp} />;
  };

  return props.root ? <Dynamic component={props.root}>{content()}</Dynamic> : <>{content()}</>;
}
