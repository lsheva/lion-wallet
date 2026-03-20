/** Inpage bundle loads `.svg` via esbuild `loader: { ".svg": "text" }`. */
declare module "*.svg" {
  const source: string;
  export default source;
}
