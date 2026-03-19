import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SVG_PATH = "src/icons/icon.svg";

const MANIFEST_SIZES = [16, 32, 48, 128];
const XCODE_APP_ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024];
const TOOLBAR_SIZE = 48;

const MANIFEST_OUT = "src/icons/generated";
const XCODE_APP_ICON_DIR =
  "xcode/SafariEVMWallet/SafariEVMWallet/Assets.xcassets/AppIcon.appiconset";
const XCODE_LARGE_ICON_DIR =
  "xcode/SafariEVMWallet/SafariEVMWallet/Assets.xcassets/LargeIcon.imageset";
const XCODE_TOOLBAR_DIR =
  "xcode/SafariEVMWallet/SafariEVMWallet Extension";
const XCODE_RESOURCES_ICON =
  "xcode/SafariEVMWallet/SafariEVMWallet/Resources/Icon.png";

for (const dir of [MANIFEST_OUT, XCODE_APP_ICON_DIR, XCODE_LARGE_ICON_DIR]) {
  mkdirSync(dir, { recursive: true });
}

async function render(size: number): Promise<Buffer> {
  return sharp(SVG_PATH, { density: Math.round((72 * size) / 512) * 4 })
    .resize(size, size)
    .png()
    .toBuffer();
}

// 1. Extension manifest icons
for (const size of MANIFEST_SIZES) {
  const buf = await render(size);
  writeFileSync(resolve(MANIFEST_OUT, `icon-${size}.png`), buf);
}
console.log("Manifest icons written to", MANIFEST_OUT);

// 2. Xcode AppIcon
const appIconImages: object[] = [];
for (const size of XCODE_APP_ICON_SIZES) {
  const filename = `icon_${size}x${size}.png`;
  const buf = await render(size);
  writeFileSync(resolve(XCODE_APP_ICON_DIR, filename), buf);
  appIconImages.push({
    filename,
    idiom: "mac",
    scale: "1x",
    size: `${size}x${size}`,
  });
  if (size <= 512) {
    const filename2x = `icon_${size}x${size}@2x.png`;
    const buf2x = await render(size * 2);
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
  JSON.stringify(
    { images: appIconImages, info: { author: "xcode", version: 1 } },
    null,
    2,
  ),
);
console.log("Xcode AppIcon written to", XCODE_APP_ICON_DIR);

// 3. Xcode LargeIcon
const largeIconImages: object[] = [];
for (const [scale, mult] of [["1x", 1], ["2x", 2], ["3x", 3]] as const) {
  const size = 128 * Number(mult);
  const filename = `icon_large_${scale}.png`;
  const buf = await render(size);
  writeFileSync(resolve(XCODE_LARGE_ICON_DIR, filename), buf);
  largeIconImages.push({ filename, idiom: "universal", scale });
}
writeFileSync(
  resolve(XCODE_LARGE_ICON_DIR, "Contents.json"),
  JSON.stringify(
    { images: largeIconImages, info: { author: "xcode", version: 1 } },
    null,
    2,
  ),
);
console.log("Xcode LargeIcon written to", XCODE_LARGE_ICON_DIR);

// 4. Xcode toolbar icon (used by Safari in the toolbar)
const toolbarBuf = await render(TOOLBAR_SIZE);
writeFileSync(resolve(XCODE_TOOLBAR_DIR, "ToolbarItemIcon.pdf"), toolbarBuf);

// 5. Container app Resources/Icon.png
const resourcesBuf = await render(256);
writeFileSync(XCODE_RESOURCES_ICON, resourcesBuf);
console.log("Xcode Resources Icon.png written");

console.log("All icons generated.");
