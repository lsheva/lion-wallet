interface IdenticonProps {
  address: string;
  size?: number;
}

function addressToColors(address: string): string[] {
  const hex = address.replace("0x", "").toLowerCase();
  const colors: string[] = [];
  for (let i = 0; i < 3; i++) {
    const slice = hex.slice(i * 8, i * 8 + 6);
    colors.push(`#${slice}`);
  }
  return colors;
}

export function Identicon({ address, size = 40 }: IdenticonProps) {
  const colors = addressToColors(address);

  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="20" fill={colors[0]} />
      <circle cx="16" cy="14" r="8" fill={colors[1]} opacity="0.7" />
      <circle cx="26" cy="24" r="10" fill={colors[2]} opacity="0.6" />
    </svg>
  );
}
