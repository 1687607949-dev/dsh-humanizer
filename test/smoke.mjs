import http from 'node:http'
import fs from 'node:fs'
import { createHandler } from '../lib/http.mjs'
import { loadLife, saveLife, worldPath } from '../lib/store.mjs'
import { todayStr } from '../lib/engine.mjs'

const server = http.createServer(createHandler())
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const base = `http://127.0.0.1:${port}/dsh-humanizer/api`

let passed = 0
let failed = 0
function check(name, cond, extra = '') {
  if (cond) {
    passed++
    console.log(`  ok  ${name}`)
  } else {
    failed++
    console.log(`FAIL  ${name}${extra ? ' — ' + extra : ''}`)
  }
}

async function call(path, options) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  return { status: res.status, data: await res.json() }
}

const original = loadLife('mumi')
const date = todayStr()

try {
  const state = await call('/state')
  check('GET /state 200', state.status === 200)
  check('life.persona_id = mumi', state.data.life?.persona_id === 'mumi')
  check('world 有事件', Array.isArray(state.data.world?.events) && state.data.world.events.length >= 1)
  check('prompt 含角色生活状态', String(state.data.prompt).includes('[角色生活状态]'))

  const life = structuredClone(original)
  life.profile.city.name = '测试城'
  life.style.casual_max_sentences = 3
  const saved = await call('/life', { method: 'PUT', body: JSON.stringify(life) })
  check('PUT /life 200', saved.status === 200, JSON.stringify(saved.data))
  const after = await call('/life')
  check('保存生效', after.data.life?.profile?.city?.name === '测试城')

  const bad = structuredClone(original)
  bad.personality.extraversion = 5
  const badRes = await call('/life', { method: 'PUT', body: JSON.stringify(bad) })
  check('非法配置被拒绝', badRes.status === 422)

  const before = await call('/state')
  const reroll = await call('/world/reroll', { method: 'POST', body: JSON.stringify({ date }) })
  check('reroll 200', reroll.status === 200)
  check('epoch +1', reroll.data.world?.epoch === before.data.world.epoch + 1)

  const eventId = original.events[0].id
  const lock = await call('/world/lock-event', {
    method: 'POST',
    body: JSON.stringify({ date, event_id: eventId, locked: true })
  })
  check('lock-event 200', lock.status === 200)
  check('锁定列表包含事件', (lock.data.world?.locked_event_ids || []).includes(eventId))

  const prompt = await call('/prompt')
  check('prompt 含心情', String(prompt.data.prompt).includes('心情：'))
} finally {
  saveLife('mumi', original)
  try { fs.unlinkSync(worldPath('mumi', date)) } catch {}
  server.close()
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
