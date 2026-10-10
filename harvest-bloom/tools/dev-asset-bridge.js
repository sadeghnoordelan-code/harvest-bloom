import fs from 'node:fs'
import path from 'node:path'

/**
 * Asset bridge for tools/cutout — off unless you ask for it.
 *
 * The cutout pipeline needs a PNG decoder and encoder. Rather than add an image
 * dependency, the pixel work runs in the browser (canvas decodes and encodes for
 * free) and the finished bytes are posted back here to be written to disk.
 *
 *   GET  /__origin[/<file>]       - lists, or streams, an untouched source photo
 *   POST /__write  { path, b64 }  - writes bytes under public/
 *   POST /__delete { paths }      - removes files inside the project
 *
 * These routes write to your working tree, so they are only mounted under
 * `npm run assets` (vite --mode assets). Plain `npm run dev` never exposes them,
 * and they are never part of a production build.
 */
export default function devAssetBridge({ root, originDir, mode = 'assets' }) {
  const publicDir = path.join(root, 'public')
  const isInside = (base, dest) => {
    const rel = path.relative(base, dest)
    return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)
  }

  return {
    name: 'harvest-bloom-dev-asset-bridge',
    apply: (config, env) => env.command === 'serve' && env.mode === mode,
    configureServer(server) {
      server.config.logger.info(
        `\n  asset tools mounted — open /tools/cutout/index.html to regenerate the pack shots\n`,
      )
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost')

        if (req.method === 'GET' && url.pathname.startsWith('/__origin/')) {
          const name = path.basename(decodeURIComponent(url.pathname.slice('/__origin/'.length)))
          const file = path.join(originDir, name)
          if (!fs.existsSync(file)) {
            res.statusCode = 404
            return res.end('no such source photo')
          }
          res.setHeader('Content-Type', 'image/png')
          res.setHeader('Cache-Control', 'no-store')
          return fs.createReadStream(file).pipe(res)
        }

        if (req.method === 'GET' && url.pathname === '/__origin') {
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify(fs.readdirSync(originDir)))
        }

        if (req.method === 'POST' && url.pathname === '/__delete') {
          let body = ''
          req.on('data', (c) => {
            body += c
          })
          req.on('end', () => {
            const removed = []
            try {
              for (const rel of JSON.parse(body).paths) {
                const dest = path.resolve(root, rel)
                if (!isInside(root, dest)) throw new Error('outside the project')
                if (fs.existsSync(dest)) {
                  fs.unlinkSync(dest)
                  removed.push(rel)
                }
              }
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, removed }))
            } catch (err) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: String(err), removed }))
            }
          })
          return
        }

        if (req.method === 'POST' && url.pathname === '/__write') {
          let body = ''
          req.on('data', (c) => {
            body += c
          })
          req.on('end', () => {
            try {
              const { path: rel, b64 } = JSON.parse(body)
              const dest = path.resolve(publicDir, rel)
              if (!isInside(publicDir, dest)) throw new Error('outside public/')
              fs.mkdirSync(path.dirname(dest), { recursive: true })
              const buf = Buffer.from(b64, 'base64')
              fs.writeFileSync(dest, buf)
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true, bytes: buf.length, dest }))
            } catch (err) {
              res.statusCode = 400
              res.end(JSON.stringify({ ok: false, error: String(err) }))
            }
          })
          return
        }

        next()
      })
    },
  }
}
