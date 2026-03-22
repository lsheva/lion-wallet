interface SkeletonProps {
  variant?: "text" | "circle" | "card";
  width?: string | number;
  height?: string | number;
  class?: string;
}

export function Skeleton({
  variant = "text",
  width,
  height,
  class: cls = "",
}: SkeletonProps) {
  const style: Record<string, string | number> = {};
  if (width) style.width = typeof width === "number" ? `${width}px` : width;
  if (height) style.height = typeof height === "number" ? `${height}px` : height;

  const base = "animate-shimmer";
  const shape =
    variant === "circle"
      ? "rounded-full"
      : variant === "card"
        ? "rounded-[var(--radius-card)] w-full"
        : "rounded-md";

  const defaults =
    variant === "text" && !height
      ? "h-3.5"
      : variant === "circle" && !width
        ? "w-8 h-8"
        : "";

  return <div class={`${base} ${shape} ${defaults} ${cls}`} style={style} />;
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
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} variant="card" height={56} />
      ))}
    </div>
  );
}
