import { AVATAR_PALETTE } from "../theme";

interface IdenticonProps {
  address: string;
  size?: number;
}

function hashCode(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const unit = (n: number, range: number, i?: number) => {
  const v = n % range;
  return i !== undefined && Math.floor((n / 10 ** i) % 10) % 2 === 0 ? -v : v;
};

function marbleSvg(name: string, sz: number): string {
  const S = 80;
  const h = hashCode(name);
  const fId = `f${h}`;
  const C = AVATAR_PALETTE;
  const el = (i: number) => {
    const n = h * (i + 1);
    return {
      color: C[(h + i) % C.length],
      tx: unit(n, S / 10, 1),
      ty: unit(n, S / 10, 2),
      sc: 1.2 + unit(n, S / 20) / 10,
      rot: unit(n, 360, 1),
    };
  };
  const [a, b, c] = [el(0), el(1), el(2)];

  const ellipse = (e: ReturnType<typeof el>) =>
    `<ellipse rx="${S / 2}" ry="${S / 2}" cx="${S / 2 + e.tx}" cy="${S / 2 + e.ty}" fill="${e.color}" transform="rotate(${e.rot} ${S / 2} ${S / 2}) scale(${e.sc})"/>`;

  return `<svg viewBox="0 0 ${S} ${S}" fill="none" xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}"><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="${S / 2}" fill="#fff"/></mask><g mask="url(#m)"><rect width="${S}" height="${S}" fill="${a.color}"/><filter id="${fId}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB" x="0" y="0" width="${S}" height="${S}"><feGaussianBlur stdDeviation="7" edgeMode="duplicate" result="blur"/></filter><g filter="url(#${fId})">${ellipse(a)}${ellipse(b)}${ellipse(c)}</g></g></svg>`;
}

export function Identicon({ address, size = 40 }: IdenticonProps) {
  return <div dangerouslySetInnerHTML={{ __html: marbleSvg(address, size) }} />;
}
