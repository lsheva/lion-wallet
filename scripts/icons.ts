import sharp from "sharp";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from "node:fs";
import { resolve } from "node:path";

/** Full-color lion — app icon, marketing, LargeIcon, Resources. */
const SVG_APP = "brand/lion.svg";
/**
 * Paw silhouette template. Path fill must stay `#f2e6d8` (light savanna tint) — the
 * script swaps it for toolbar / manifest PNGs. A subtle blue stroke in the SVG prevents
 * Safari from classifying the rasterized PNGs as grayscale template images.
 */
const PAW_TEMPLATE = "brand/lion-paw-toolbar.svg";
const PAW_TEMPLATE_FILL = "#f2e6d8";

/**
 * Paw fills — slightly warm RGB (not neutral gray) so PNGs stay truecolor.
 * Pure gray PNGs are often treated as template masks and tinted with system accent (blue).
 */
const PAW_FILL_DARK_UI = "#ebe8e6";
const PAW_FILL_LIGHT_UI = "#3f3a38";

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

// 1. Extension manifest icons; `*-darkui` = dark toolbar variant
for (const size of MANIFEST_SIZES) {
  const lightUi = await renderPaw(PAW_FILL_LIGHT_UI, size);
  const darkUi = await renderPaw(PAW_FILL_DARK_UI, size);
  writeFileSync(resolve(MANIFEST_OUT, `icon-${size}.png`), lightUi);
  writeFileSync(resolve(MANIFEST_OUT, `icon-${size}-darkui.png`), darkUi);
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
  const buf = await render(SVG_APP, size);
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

// 4. Xcode extension folder — toolbar PNGs + vector PDF
const toolbarDark = await renderPaw(PAW_FILL_DARK_UI, TOOLBAR_SIZE);
const toolbarLight = await renderPaw(PAW_FILL_LIGHT_UI, TOOLBAR_SIZE);
writeFileSync(resolve(XCODE_TOOLBAR_DIR, "ToolbarItemIcon-darkui.png"), toolbarDark);
writeFileSync(resolve(XCODE_TOOLBAR_DIR, "ToolbarItemIcon-lightui.png"), toolbarLight);

// ToolbarItemIcon.pdf — vector PDF so Safari renders the paw without template tinting
const PDF_PT = 48;
await new Promise<void>((res, rej) => {
  const doc = new PDFDocument({ size: [PDF_PT, PDF_PT], margin: 0 });
  const out = createWriteStream(resolve(XCODE_TOOLBAR_DIR, "ToolbarItemIcon.pdf"));
  doc.pipe(out);
  SVGtoPDF(doc, pawSvgWithFill(PAW_FILL_LIGHT_UI), 0, 0, {
    width: PDF_PT,
    height: PDF_PT,
    preserveAspectRatio: "xMidYMid meet",
  });
  doc.end();
  out.on("finish", res);
  out.on("error", rej);
});
console.log("Toolbar vector PDF written");

// 5. Container app Resources/Icon.png
const resourcesBuf = await render(SVG_APP, 256);
writeFileSync(XCODE_RESOURCES_ICON, resourcesBuf);
console.log("Xcode Resources Icon.png written");

console.log("All icons generated.");
