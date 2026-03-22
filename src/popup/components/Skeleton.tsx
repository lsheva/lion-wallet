import { For, mergeProps } from "solid-js";

interface SkeletonProps {
  variant?: "text" | "circle" | "card";
  width?: string | number;
  height?: string | number;
  class?: string;
}

export function Skeleton(rawProps: SkeletonProps) {
  const props = mergeProps({ variant: "text" as const, class: "" }, rawProps);

  const style = () => {
    const s: Record<string, string | number> = {};
    if (props.width) s.width = typeof props.width === "number" ? `${props.width}px` : props.width;
    if (props.height)
      s.height = typeof props.height === "number" ? `${props.height}px` : props.height;
    return s;
  };

  const shape = () =>
    props.variant === "circle"
      ? "rounded-full"
      : props.variant === "card"
        ? "rounded-[var(--radius-card)] w-full"
        : "rounded-md";

  const defaults = () =>
    props.variant === "text" && !props.height
      ? "h-3.5"
      : props.variant === "circle" && !props.width
        ? "w-8 h-8"
        : "";

  return <div class={`animate-shimmer ${shape()} ${defaults()} ${props.class}`} style={style()} />;
}

export function TokenRowSkeleton() {
  return (
    <div class="flex items-start w-full px-4 py-3 gap-2">
      <Skeleton variant="circle" width={32} height={32} class="shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0 space-y-1.5 pt-1">
        <Skeleton width="60%" />
      </div>
      <div class="text-right shrink-0 ml-2 space-y-1.5 pt-1">
        <Skeleton width={72} />
      </div>
    </div>
  );
}

export function ActivityRowSkeleton() {
  return (
    <div class="flex items-start w-full px-4 py-2.5 gap-3">
      <Skeleton variant="circle" width={32} height={32} class="shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0 space-y-1.5 pt-1">
        <Skeleton width="45%" />
        <Skeleton width="30%" height={10} />
      </div>
      <div class="shrink-0 pt-1">
        <Skeleton width={56} />
      </div>
    </div>
  );
}

export function BalanceSkeleton() {
  return <Skeleton width={100} height={24} class="rounded-lg" />;
}

export function GasPresetsSkeleton() {
  return (
    <div class="grid grid-cols-3 gap-2">
      <For each={[0, 1, 2]}>{() => <Skeleton variant="card" height={56} />}</For>
    </div>
  );
}
