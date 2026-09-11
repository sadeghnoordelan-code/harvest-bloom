import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devAssetBridge from './tools/dev-asset-bridge.js'

const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // Only mounts under `npm run assets`; see tools/dev-asset-bridge.js.
    devAssetBridge({ root, originDir: path.join(root, '..', 'Photos'), mode: 'assets' }),
  ],
  server: {
    // Vite does not read PORT on its own. The launcher assigns a free port and
    // passes it in that variable, so honour it when it is set and fall back to
    // Vite's own default otherwise. Nothing here is pinned to a fixed port —
    // there are no OAuth callbacks, webhooks or port-bound CORS rules — so
    // taking whatever is free keeps this out of the way of other dev servers.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
})
