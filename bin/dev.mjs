import http from 'node:http'
import { createHandler } from '../lib/http.mjs'

const port = Number(process.env.DSH_HUMANIZER_PORT || 18760)
const host = process.env.DSH_HUMANIZER_HOST || '127.0.0.1'
const server = http.createServer(createHandler())

server.listen(port, host, () => {
  const url = `http://${host}:${port}/dsh-humanizer/panel`
  console.log(`[dsh-humanizer] panel: ${url}`)
  console.log('[dsh-humanizer] Ctrl+C 停止')
})
