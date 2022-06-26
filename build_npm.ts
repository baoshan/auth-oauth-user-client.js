import { build, emptyDir } from "https://deno.land/x/dnt/mod.ts";
import denoConfig from "./deno.json" assert { type: "json" };

await emptyDir("./npm");
await build({
  compilerOptions: { lib: ["esnext", "dom"] },
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: { deno: false },
  test: false,
  importMap: denoConfig.importMap,
  package: {
    name: "octokit-auth-oauth-user-client",
    version: Deno.args[0],
    description:
      "Octokit authentication strategy for OAuth user authentication without exposing client secret.",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/baoshan/octokit-auth-oauth-user-client.js.git",
    },
    bugs: {
      url: "https://github.com/baoshan/octokit-auth-oauth-user-client.js/issues",
    },
  },
});

// post build steps
Deno.copyFileSync("LICENSE", "npm/LICENSE");
Deno.copyFileSync("README.md", "npm/README.md");
