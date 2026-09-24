export { default } from "./main.mjs";
export const config = {
  name: "server handler",
  generator: "nuxt@4.5.2",
  path: "/*",
  nodeBundler: "none",
  includedFiles: ["**"],
  excludedPath: ["/.netlify/*","/_nuxt/builds/meta/*","/_nuxt/builds/*","/_fonts/*","/_nuxt/*"],
  preferStatic: true,
};