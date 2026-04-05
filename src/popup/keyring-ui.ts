const DOTS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-fuchsia-500",
  "bg-lime-600",
];

export function keyringDotClass(keyringId: string): string {
  let h = 0;
  for (let i = 0; i < keyringId.length; i++) h = (h * 31 + keyringId.charCodeAt(i)) | 0;
  return DOTS[Math.abs(h) % DOTS.length] ?? "bg-text-tertiary";
}
