import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

/** Full-color lion — app icon, marketing, LargeIcon, Resources. */
const SVG_APP = "brand/lion.svg";
/**
 * Paw silhouette template. Path fill must stay `#f2e6d8` (light savanna tint) — the
 * script swaps it for toolbar / manifest PNGs. A full-opacity blue stroke (2.5 units on
 * the 9167-unit viewBox ≈ sub-pixel at all render sizes) prevents Safari from classifying
 * the output as grayscale and applying the system accent color tint.
 */
const PAW_TEMPLATE = "brand/lion-paw-toolbar.svg";
const PAW_TEMPLATE_FILL = "#f2e6d8";

/**
 * Light warm off-white fill — visible on both light and dark toolbars, and slightly
 * warm so Safari doesn't classify the PNG as grayscale and apply template tinting.
 */
const PAW_FILL = "#ebe8e6";

const MANIFEST_SIZES = [16, 32, 48, 128];
const XCODE_APP_ICON_SIZES = [16, 32, 128, 256, 512];
const TOOLBAR_PT = 48;

const MANIFEST_OUT = "src/icons/generated";
const XCODE_APP_ICON_DIR =
  "xcode/SafariEVMWallet/SafariEVMWallet/Assets.xcassets/AppIcon.appiconset";
const XCODE_LARGE_ICON_DIR =
  "xcode/SafariEVMWallet/SafariEVMWallet/Assets.xcassets/LargeIcon.imageset";
const XCODE_TOOLBAR_IMAGESET =
  "xcode/SafariEVMWallet/SafariEVMWallet Extension/ToolbarItemIcon.xcassets/ToolbarItemIcon.imageset";
const XCODE_RESOURCES_ICON = "xcode/SafariEVMWallet/SafariEVMWallet/Resources/Icon.png";

for (const dir of [
  MANIFEST_OUT,
  XCODE_APP_ICON_DIR,
  XCODE_LARGE_ICON_DIR,
  XCODE_TOOLBAR_IMAGESET,
]) {
  mkdirSync(dir, { recursive: true });
}

function pawSvgWithFill(fill: string): string {
  const raw = readFileSync(PAW_TEMPLATE, "utf8");
  return raw.replace(new RegExp(PAW_TEMPLATE_FILL, "gi"), fill);
}

async function renderPaw(fill: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(pawSvgWithFill(fill), "utf8"), { limitInputPixels: false })
    .resize(size, size)
    .png({ palette: false, compressionLevel: 9 })
    .toBuffer();
}

async function render(svgPath: string, size: number): Promise<Buffer> {
  return sharp(svgPath, {
    density: Math.round((72 * size) / 512) * 4,
  })
    .resize(size, size)
    .png()
    .toBuffer();
}

// 1. Extension manifest icons (single light-colored paw)
for (const size of MANIFEST_SIZES) {
  const buf = await renderPaw(PAW_FILL, size);
  writeFileSync(resolve(MANIFEST_OUT, `icon-${size}.png`), buf);
}
console.log("Manifest icons written to", MANIFEST_OUT);

// 2. Xcode AppIcon
const appIconImages: object[] = [];
for (const size of XCODE_APP_ICON_SIZES) {
  const filename = `icon_${size}x${size}.png`;
  const buf = await render(SVG_APP, size);
  writeFileSync(resolve(XCODE_APP_ICON_DIR, filename), buf);
  appIconImages.push({
    filename,
    idiom: "mac",
    scale: "1x",
    size: `${size}x${size}`,
  });
  if (size <= 512) {
    const filename2x = `icon_${size}x${size}@2x.png`;
    const buf2x = await render(SVG_APP, size * 2);
    writeFileSync(resolve(XCODE_APP_ICON_DIR, filename2x), buf2x);
    appIconImages.push({
      filename: filename2x,
      idiom: "mac",
      scale: "2x",
      size: `${size}x${size}`,
    });
  }
}
writeFileSync(
  resolve(XCODE_APP_ICON_DIR, "Contents.json"),
  JSON.stringify({ images: appIconImages, info: { author: "xcode", version: 1 } }, null, 2),
);
console.log("Xcode AppIcon written to", XCODE_APP_ICON_DIR);

// 3. Xcode LargeIcon
const largeIconImages: object[] = [];
for (const [scale, mult] of [
  ["1x", 1],
  ["2x", 2],
  ["3x", 3],
] as const) {
  const size = 128 * Number(mult);
  const filename = `icon_large_${scale}.png`;
  const buf = await render(SVG_APP, size);
  writeFileSync(resolve(XCODE_LARGE_ICON_DIR, filename), buf);
  largeIconImages.push({ filename, idiom: "universal", scale });
}
writeFileSync(
  resolve(XCODE_LARGE_ICON_DIR, "Contents.json"),
  JSON.stringify({ images: largeIconImages, info: { author: "xcode", version: 1 } }, null, 2),
);
console.log("Xcode LargeIcon written to", XCODE_LARGE_ICON_DIR);

// 4. Toolbar icon asset catalog
const toolbar1x = await renderPaw(PAW_FILL, TOOLBAR_PT);
const toolbar2x = await renderPaw(PAW_FILL, TOOLBAR_PT * 2);
writeFileSync(resolve(XCODE_TOOLBAR_IMAGESET, "ToolbarItemIcon.png"), toolbar1x);
writeFileSync(resolve(XCODE_TOOLBAR_IMAGESET, "ToolbarItemIcon@2x.png"), toolbar2x);
console.log("Toolbar asset catalog written to", XCODE_TOOLBAR_IMAGESET);

// 5. Container app Resources/Icon.png
const resourcesBuf = await render(SVG_APP, 256);
writeFileSync(XCODE_RESOURCES_ICON, resourcesBuf);
console.log("Xcode Resources Icon.png written");

console.log("All icons generated.");
