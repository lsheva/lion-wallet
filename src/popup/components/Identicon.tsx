import avatar from "animal-avatar-generator";

interface IdenticonProps {
  address: string;
  size?: number;
}

const AVATAR_COLORS = [
  "#F0CB95", "#DC994E", "#E9AF69", // mane / face warmth
  "#D97706", "#FBBF24", "#B45309", // amber brand tones
];

const BG_COLORS = [
  "#FEF3C7", "#FFEDD5", "#FFFBEB", "#FFF7ED", "#FFFCF8",
];

export function Identicon({ address, size = 40 }: IdenticonProps) {
  const svg = avatar(address, {
    size,
    round: true,
    blackout: false,
    avatarColors: AVATAR_COLORS,
    backgroundColors: BG_COLORS,
  });

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}
