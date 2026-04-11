import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { resolve } from "path"
import { createRequire } from "module"
import { readFileSync } from "fs"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import type { Plugin } from "vite"

const _require = createRequire(import.meta.url)
const pkg = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string }

const root = resolve(__dirname)
const webDir = resolve(root, "web")
const srcDir = resolve(root, "src")

const fileShims: Record<string, string> = {
  async_hooks: resolve(webDir, "shims/async-hooks.ts"),
  "fs/promises": resolve(webDir, "shims/fs-promises.ts"),
  path: resolve(webDir, "shims/path.ts"),
  crypto: resolve(webDir, "shims/crypto.ts"),
  process: resolve(webDir, "shims/process.ts"),
  child_process: resolve(webDir, "shims/child-process.ts"),
  electron: resolve(webDir, "shims/electron.ts"),
  "electron-store": resolve(webDir, "shims/electron-store.ts")
}

const packageShims: Record<string, string> = {
  fs: _require.resolve("@zenfs/core"),
  events: _require.resolve("eventemitter3"),
  readline: _require.resolve("@zenfs/core/readline")
}

function esbuildShimsPlugin() {
  return {
    name: "vite-web-shims",
    setup(build: any) {
      build.onResolve({ filter: /.*/ }, (args: { path: string }) => {
        let id = args.path
        if (id.startsWith("node:")) id = id.slice(5)
        if (fileShims[id]) return { path: fileShims[id] }
        if (packageShims[id]) return { path: packageShims[id] }
        return undefined
      })
    }
  }
}

function stripNodeProtocol(): Plugin {
  return {
    name: "strip-node-protocol",
    enforce: "pre",
    async resolveId(id, importer, options) {
      if (id.startsWith("node:")) {
        const stripped = id.slice(5)
        return this.resolve(stripped, importer, { ...options, skipSelf: true })
      }
    }
  }
}

function sqlJsShim(): Plugin {
  const shimPath = resolve(webDir, "shims/sql-js.ts")
  return {
    name: "sql-js-shim",
    enforce: "pre",
    resolveId(id, importer) {
      if (id === "sql.js") {
        if (importer && importer.includes("sql-js")) return null
        return shimPath
      }
    }
  }
}

function serveWebIndex(): Plugin {
  return {
    name: "serve-web-index",
    configureServer(server) {
      server.middlewares.use((req: any, _res: any, next: any) => {
        if (req.url === "/" || req.url === "") req.url = "/web/index.html"
        next()
      })
    }
  }
}

export default defineConfig({
  root,

  build: {
    outDir: resolve(root, "out/web"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: {
      input: resolve(webDir, "index.html")
    }
  },

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_NODE_VERSION__: JSON.stringify(process.versions.node),
    __dirname: JSON.stringify("/"),
    __filename: JSON.stringify("/index.js"),
    "process.env": JSON.stringify({}),
    "process.platform": JSON.stringify("web"),
    "process.release": JSON.stringify({ name: "browser" }),
    "process.type": JSON.stringify("renderer"),
    "process.versions": JSON.stringify({ node: process.versions.node }),
    "process.version": JSON.stringify(`v${process.versions.node}`)
  },

  resolve: {
    alias: [
      { find: "electron", replacement: resolve(webDir, "shims/electron.ts") },
      { find: "electron-store", replacement: resolve(webDir, "shims/electron-store.ts") },
      { find: "child_process", replacement: resolve(webDir, "shims/child-process.ts") },
      { find: /^fs\/promises$/, replacement: resolve(webDir, "shims/fs-promises.ts") },
      { find: /^fs$/, replacement: "@zenfs/core" },
      { find: /^path$/, replacement: resolve(webDir, "shims/path.ts") },
      { find: /^crypto$/, replacement: resolve(webDir, "shims/crypto.ts") },
      { find: /^async_hooks$/, replacement: resolve(webDir, "shims/async-hooks.ts") },
      { find: /^process$/, replacement: resolve(webDir, "shims/process.ts") },
      { find: /^events$/, replacement: "eventemitter3" },
      { find: /^readline$/, replacement: "@zenfs/core/readline" },
      { find: "@renderer", replacement: resolve(srcDir, "renderer/src") },
      { find: "@", replacement: resolve(srcDir, "renderer/src") }
    ]
  },

  plugins: [
    serveWebIndex(),
    stripNodeProtocol(),
    sqlJsShim(),
    nodePolyfills({
      exclude: [
        "fs",
        "path",
        "crypto",
        "async_hooks",
        "child_process",
        "events",
        "readline",
        "process"
      ],
      globals: { Buffer: true, process: false },
      protocolImports: false
    }),
    react(),
    tailwindcss()
  ],

  optimizeDeps: {
    exclude: ["just-bash"],
    include: [
      "@zenfs/core",
      "@zenfs/dom",
      "eventemitter3",
      "utilium",
      "path-browserify",
      "sql.js",
      "sprintf-js"
    ],
    esbuildOptions: {
      plugins: [esbuildShimsPlugin()],
      define: {
        global: "globalThis",
        __dirname: '"/"',
        __filename: '"index.js"',
        "process.type": '"renderer"'
      }
    }
  },

  server: {
    port: 3000,
    host: "0.0.0.0"
  }
})
