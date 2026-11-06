import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { agentNative } from "@agent-native/core/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defaultClientConditions, defineConfig, type Plugin } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * The browser fire detector runs on onnxruntime-web. Its WebAssembly runtimes
 * are copied from node_modules into public/ort/ (served at /ort/ and set as
 * ort.env.wasm.wasmPaths) so nothing loads from a CDN: plain SIMD for the WASM
 * backend, asyncify for WebGPU. public/ort/ is generated, not committed.
 */
const ORT_FILES = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.asyncify.wasm",
  "ort-wasm-simd-threaded.asyncify.mjs",
];
function ortWasm(): Plugin {
  return {
    name: "sentinel-ort-wasm",
    configResolved() {
      const from = path.join(appRoot, "node_modules/onnxruntime-web/dist");
      const to = path.join(appRoot, "public/ort");
      fs.mkdirSync(to, { recursive: true });
      for (const f of ORT_FILES) {
        const src = path.join(from, f);
        const dst = path.join(to, f);
        if (!fs.existsSync(dst) || fs.statSync(dst).size !== fs.statSync(src).size) {
          fs.copyFileSync(src, dst);
        }
      }
    },
    // In dev, Vite refuses to let source import() a file from public/ (the
    // runtime loads its .mjs glue that way), so serve /ort/ directly.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url?.match(/^\/ort\/([^?]+)/)?.[1];
        if (!name || !ORT_FILES.includes(name)) return next();
        res.setHeader(
          "Content-Type",
          name.endsWith(".wasm") ? "application/wasm" : "text/javascript",
        );
        fs.createReadStream(path.join(appRoot, "public/ort", name)).pipe(res);
      });
    },
  };
}

const reactRouterPlugins = reactRouter as unknown as () => any[];
const agentNativePlugins = agentNative as unknown as (
  options?: Parameters<typeof agentNative>[0],
) => any[];
export default defineConfig({
  // `onnxruntime-web-use-extern-wasm` picks the builds that load their runtime
  // from wasmPaths instead of emitting a second copy of each .wasm.
  resolve: {
    conditions: ["onnxruntime-web-use-extern-wasm", ...defaultClientConditions],
  },
  optimizeDeps: {
    entries: [
      "app/entry.client.tsx",
      "app/root.tsx",
      "app/components/layout/{Layout,Sidebar}.tsx",
      "app/components/chat/ChatRouteContent.tsx",
      "app/routes/{home,chat.$threadId,fires.$fireId}.tsx",
      "app/sentinel/SentinelApp.tsx",
    ],
    // Discovery is limited to the entries above, so the map's CommonJS
    // dependencies (earcut and friends) must be pre-bundled explicitly.
    include: [
      "@deck.gl/core",
      "@deck.gl/extensions",
      "@deck.gl/geo-layers",
      "@deck.gl/layers",
      "@deck.gl/mesh-layers",
      "@deck.gl/react",
      "@luma.gl/core",
      "@luma.gl/shadertools",
    ],
    exclude: ["onnxruntime-web"],
  },
  plugins: [
    ortWasm(),
    ...reactRouterPlugins(),
    ...agentNativePlugins({
      ssrStubs: ["shiki"],
    }),
  ],
});
