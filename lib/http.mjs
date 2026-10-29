import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyInteractionMood, buildPrompt, expressionPreview, todayStr } from './engine.mjs'
import { aiSchema, applyPatchToLife, derivePatchFromPersona } from './ai.mjs'
import { authorPrompt, loadAuthor } from './author.mjs'
import { intimacyPrompt, resolveIntimacy } from './intimacy.mjs'
import { createWish, fulfillWish, wishForPrompt } from './wish.mjs'
import { getOnboarding, loadPersonaOverrides, onboardingPrompt, resetOnboarding, saveOnboarding } from './onboarding.mjs'
import { affectionStatus, recordInteraction, refresh } from './affection.mjs'
import { draftProfile, loadProfile, profilePrompt, profileStats, saveProfile } from './userprofile.mjs'
import { appendJournal, buildOverview, environmentFor } from './voice.mjs'
import {
  appendJournalEntry,
  appendLog,
  getWorld,
  loadArchetypes,
  loadLife,
  lockEvent,
  lockWeather,
  readLogs,
  rerollWorld,
  resetMood,
  saveLife,
  saveWorld,
  validateLife
} from './store.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEB_DIR = path.resolve(__dirname, '..', 'web')
const AVATARS_DIR = path.resolve(__dirname, '..', 'data', 'avatars')
const BACKGROUNDS_DIR = path.resolve(__dirname, '..', 'data', 'backgrounds')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
}

function sendJson(res, code, value) {
  const body = JSON.stringify(value)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(body)
}

function sendError(res, code, error, details) {
  sendJson(res, code, { ok: false, error: { code, message: error, ...(details ? { details } : {}) } })
}

function sendFile(res, file) {
  try {
    const buf = fs.readFileSync(file)
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    res.end(buf)
    return true
  } catch {
    return false
  }
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    let aborted = false
    const chunks = []
    req.on('data', (chunk) => {
      if (aborted) return
      size += chunk.length
      if (size > limit) {
        // 不能 req.destroy()：客户端只会收到 ECONNRESET，看不到任何原因。
        // 这里停止累积但继续把剩余数据丢弃读完，让上层能正常回一个 413。
        aborted = true
        chunks.length = 0
        const err = new Error(`请求体过大（上限 ${Math.round(limit / 1048576)}MB）`)
        err.code = 'PAYLOAD_TOO_LARGE'
        reject(err)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (aborted) return
      if (!chunks.length) return resolve(null)
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('JSON 解析失败'))
      }
    })
    req.on('error', (err) => { if (!aborted) reject(err) })
  })
}

function lifeOf(body) {
  return body && body.life ? body.life : body
}

export function createHandler(options = {}) {
  const basePath = options.basePath || '/dsh-humanizer'

  return async function handler(req, res) {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const pathname = decodeURIComponent(url.pathname)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
      return res.end()
    }

    try {
      if (pathname === basePath || pathname === `${basePath}/`) {
        res.writeHead(302, { Location: `${basePath}/panel` })
        return res.end()
      }
      if (pathname === `${basePath}/background`) {
        const name = String(url.searchParams.get('name') || 'mumi-full.png')
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) return sendError(res, 400, '非法背景名')
        if (sendFile(res, path.join(BACKGROUNDS_DIR, name))) return
        return sendError(res, 404, '背景不存在')
      }
      if (pathname === `${basePath}/avatar`) {
        const name = String(url.searchParams.get('name') || 'mumi.png')
        if (!/^[a-zA-Z0-9._-]+$/.test(name)) return sendError(res, 400, '非法头像名')
        if (sendFile(res, path.join(AVATARS_DIR, name))) return
        return sendError(res, 404, '头像不存在')
      }
      if (pathname === `${basePath}/panel`) {
        if (sendFile(res, path.join(WEB_DIR, 'panel.html'))) return
        return sendError(res, 404, 'panel.html 不存在')
      }
      if (pathname === `${basePath}/launcher.js`) {
        if (sendFile(res, path.join(WEB_DIR, 'launcher.js'))) return
        return sendError(res, 404, 'launcher.js 不存在')
      }
      if (pathname.startsWith(`${basePath}/assets/`)) {
        const rel = pathname.slice(`${basePath}/assets/`.length)
        if (rel.includes('..')) return sendError(res, 400, '非法路径')
        if (sendFile(res, path.join(WEB_DIR, 'assets', rel))) return
        return sendError(res, 404, '资源不存在')
      }

      if (!pathname.startsWith(`${basePath}/api/`)) return sendError(res, 404, '未找到')
      const api = pathname.slice(`${basePath}/api/`.length)

      if (req.method === 'GET' && api === 'health') {
        return sendJson(res, 200, { ok: true, version: '0.1.0' })
      }

      if (req.method === 'GET' && api === 'state') {
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: url.searchParams.get('date') || todayStr() })
        const archetypes = loadArchetypes()
        const author = loadAuthor()
        const profile = loadProfile() || {}
        const overrides = loadPersonaOverrides()
        const extra = [
          onboardingPrompt(profile, overrides),
          intimacyPrompt(life, profile),
          wishForPrompt(life),
          authorPrompt(author),
          '互动记录：聊天或完成任务后调用 humanizer_record_interaction；纯工作会枯燥，聊天按内容变化。'
        ].filter(Boolean).join('\n')
        return sendJson(res, 200, {
          ok: true,
          life,
          world,
          archetypes,
          prompt: buildPrompt(life, world, extra),
          preview: expressionPreview(archetypes, life.affection?.archetype, life.affection?.affection),
          overview: buildOverview(life, world, archetypes),
          environment: environmentFor(life, world),
          journal: world.journal || [],
          affection: affectionStatus(life),
          author,
          profile,
          onboarding: getOnboarding(),
          personaOverrides: overrides,
          today: todayStr()
        })
      }

      if (req.method === 'GET' && api === 'life') {
        return sendJson(res, 200, { ok: true, life: loadLife('mumi') })
      }

      if (req.method === 'GET' && api === 'avatars') {
        let files = []
        try {
          files = fs.readdirSync(AVATARS_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        } catch {}
        return sendJson(res, 200, {
          ok: true,
          avatars: files.map((f) => ({ name: f, url: `${basePath}/avatar?name=${encodeURIComponent(f)}` }))
        })
      }

      if (req.method === 'POST' && api === 'avatar') {
        // 3MB 图片经 base64 膨胀约 4MB，留足余量；上限由下面的 buf.length 判定
        const body = await readBody(req, 8 * 1024 * 1024)
        const life = loadLife('mumi')
        life.profile = life.profile || {}
        if (body?.data_url) {
          const m = String(body.data_url).match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
          if (!m) return sendError(res, 400, '不支持的图片格式')
          const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
          const buf = Buffer.from(m[2], 'base64')
          if (buf.length > 3 * 1024 * 1024) return sendError(res, 413, '图片太大（>3MB）')
          const name = `custom-${Date.now()}.${ext}`
          fs.mkdirSync(AVATARS_DIR, { recursive: true })
          fs.writeFileSync(path.join(AVATARS_DIR, name), buf)
          const avatar = `${basePath}/avatar?name=${name}`
          life.profile.avatar = avatar
          saveLife('mumi', life)
          appendLog({ event: 'avatar_upload', name })
          return sendJson(res, 200, { ok: true, url: avatar, life })
        }
        const avatar = String(body?.url || '')
        if (!avatar.startsWith(`${basePath}/avatar?name=`)) return sendError(res, 400, '非法头像地址')
        life.profile.avatar = avatar
        saveLife('mumi', life)
        appendLog({ event: 'avatar_select', avatar })
        return sendJson(res, 200, { ok: true, url: avatar, life })
      }

      if (req.method === 'PUT' && api === 'life') {
        const body = await readBody(req)
        const life = lifeOf(body)
        if (!life) return sendError(res, 400, '缺少 life 对象')
        const result = saveLife('mumi', life)
        appendLog({ event: 'save_life', config_hash: result.config_hash })
        return sendJson(res, 200, { ok: true, result })
      }

      if (req.method === 'POST' && api === 'journal') {
        const body = await readBody(req)
        const text = String(body?.text || '').trim()
        if (!text) return sendError(res, 400, '缺少 text')
        const life = loadLife('mumi')
        const world = appendJournalEntry(life, text, body?.date)
        const archetypes = loadArchetypes()
        appendLog({ event: 'journal', text })
        return sendJson(res, 200, {
          ok: true, world, journal: world.journal,
          overview: buildOverview(life, world, archetypes)
        })
      }

      if (req.method === 'GET' && api === 'backgrounds') {
        let files = []
        try {
          files = fs.readdirSync(BACKGROUNDS_DIR).filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
        } catch {}
        return sendJson(res, 200, {
          ok: true,
          backgrounds: files.map((f) => ({ name: f, url: `${basePath}/background?name=${encodeURIComponent(f)}` }))
        })
      }

      if (req.method === 'POST' && api === 'background') {
        // 6MB 图片经 base64 膨胀约 8MB，留足余量；上限由下面的 buf.length 判定
        const body = await readBody(req, 12 * 1024 * 1024)
        const life = loadLife('mumi')
        life.profile = life.profile || {}
        if (body?.data_url) {
          const m = String(body.data_url).match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
          if (!m) return sendError(res, 400, '不支持的图片格式')
          const ext = m[1].toLowerCase() === 'jpeg' ? 'jpg' : m[1].toLowerCase()
          const buf = Buffer.from(m[2], 'base64')
          if (buf.length > 6 * 1024 * 1024) return sendError(res, 413, '图片太大（>6MB）')
          const name = `custom-${Date.now()}.${ext}`
          fs.mkdirSync(BACKGROUNDS_DIR, { recursive: true })
          fs.writeFileSync(path.join(BACKGROUNDS_DIR, name), buf)
          const background = `${basePath}/background?name=${name}`
          life.profile.background = background
          saveLife('mumi', life)
          appendLog({ event: 'background_upload', name })
          return sendJson(res, 200, { ok: true, url: background, life })
        }
        const background = String(body?.url || '')
        if (!background.startsWith(`${basePath}/background?name=`)) return sendError(res, 400, '非法背景地址')
        life.profile.background = background
        saveLife('mumi', life)
        appendLog({ event: 'background_select', background })
        return sendJson(res, 200, { ok: true, url: background, life })
      }

      if (req.method === 'GET' && api === 'affection') {
        const life = loadLife('mumi')
        refresh(life)
        return sendJson(res, 200, { ok: true, affection: affectionStatus(life) })
      }

      if (req.method === 'POST' && api === 'interaction') {
        const body = await readBody(req)
        const allowed = new Set(['emotional', 'inner_peek', 'journal', 'task', 'tool', 'inappropriate', 'wish'])
        const kind = String(body?.kind || '')
        if (!allowed.has(kind)) return sendError(res, 400, '未知互动类型')
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: todayStr() })
        const note = String(body?.note || '')
        const result = recordInteraction(life, kind, note)
        applyInteractionMood(world, kind, note)
        if (kind === 'emotional' || kind === 'wish' || kind === 'inappropriate') {
          const text = kind === 'wish'
            ? `和主人完成了她想要的事${note ? `：${note.slice(0, 40)}` : ''}。`
            : kind === 'inappropriate'
              ? '和主人闹了点不愉快。'
              : `和主人聊了一会儿${note ? `：${note.slice(0, 40)}` : ''}。`
          world.journal = Array.isArray(world.journal) ? world.journal : []
          world.journal.push(appendJournal(life, text))
        }
        saveWorld(world)
        appendLog({ event: 'interaction', kind, delta: result.delta })
        return sendJson(res, 200, { ok: true, result, affection: affectionStatus(life) })
      }

      if (req.method === 'GET' && api === 'profile') {
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: todayStr() })
        const stats = profileStats(life, world)
        return sendJson(res, 200, {
          ok: true,
          stats,
          profile: loadProfile() || draftProfile(stats),
          prompt: profilePrompt(stats)
        })
      }

      if (req.method === 'POST' && api === 'profile/draft') {
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: todayStr() })
        const stats = profileStats(life, world)
        const profile = saveProfile(draftProfile(stats))
        appendLog({ event: 'profile_draft' })
        return sendJson(res, 200, { ok: true, stats, profile })
      }

      if (req.method === 'POST' && api === 'profile') {
        const body = await readBody(req)
        const existing = loadProfile() || {}
        const profile = saveProfile({
          ...existing,
          summary: String(body?.summary || existing.summary || ''),
          traits: Array.isArray(body?.traits) ? body.traits : (existing.traits || []),
          suggestions: Array.isArray(body?.suggestions) ? body.suggestions : (existing.suggestions || []),
          preferences: body?.preferences || existing.preferences || {},
          source: 'ai'
        })
        appendLog({ event: 'profile_save' })
        return sendJson(res, 200, { ok: true, profile })
      }

      if (req.method === 'GET' && api === 'author') {
        return sendJson(res, 200, { ok: true, author: loadAuthor() })
      }

      if (req.method === 'POST' && api === 'inner-peek') {
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: todayStr() })
        const wish = createWish(life, world)
        saveLife(life.persona_id, life)
        const overview = buildOverview(life, world, loadArchetypes())
        return sendJson(res, 200, { ok: true, wish, inner: overview.inner, affection: affectionStatus(life) })
      }

      if (req.method === 'POST' && api === 'wish/fulfill') {
        const body = await readBody(req)
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: todayStr() })
        const result = fulfillWish(life, body?.act || '')
        let delta = 0
        if (result.matched) {
          const rec = recordInteraction(life, 'wish')
          delta = rec.delta
          const note = `愿望：${result.wish?.label || body?.act || ''}`
          applyInteractionMood(world, 'wish', note)
          world.journal = Array.isArray(world.journal) ? world.journal : []
          world.journal.push(appendJournal(life, `和主人完成了她想要的事：${result.wish?.label || body?.act || ''}。`))
          saveWorld(world)
        } else {
          saveLife(life.persona_id, life)
        }
        appendLog({ event: 'wish_fulfill', act: body?.act || '', matched: result.matched })
        return sendJson(res, 200, { ok: true, ...result, delta, affection: affectionStatus(life) })
      }

      if (req.method === 'POST' && api === 'intimacy') {
        const body = await readBody(req)
        const life = loadLife('mumi')
        refresh(life)
        const world = getWorld(life, { date: todayStr() })
        const profile = loadProfile() || {}
        const result = resolveIntimacy(life, String(body?.act || 'hug'), world, profile)
        let wishFulfilled = false
        let wishDelta = 0
        if (result.allowed) {
          const wish = fulfillWish(life, result.act)
          if (wish.matched) {
            wishFulfilled = true
            wishDelta = recordInteraction(life, 'wish').delta
          }
          applyInteractionMood(world, wishFulfilled ? 'wish' : 'emotional', result.act)
          world.journal = Array.isArray(world.journal) ? world.journal : []
          world.journal.push(appendJournal(life, `和主人${result.label || result.act}了一下。`))
        } else {
          applyInteractionMood(world, 'inappropriate', result.act)
        }
        saveWorld(world)
        appendLog({ event: 'intimacy', act: result.act, allowed: result.allowed, wish: wishFulfilled })
        return sendJson(res, 200, { ok: true, ...result, wishFulfilled, wishDelta })
      }

      if (req.method === 'PUT' && api === 'profile/preferences') {
        const body = await readBody(req)
        const profile = loadProfile() || { summary: '', traits: [], suggestions: [] }
        const prefs = { ...(profile.preferences || {}) }
        if (body?.intimacy_style) prefs.intimacy_style = String(body.intimacy_style)
        if (typeof body?.note === 'string') prefs.note = body.note.trim()
        if (Array.isArray(body?.likes)) prefs.likes = body.likes.map((x) => String(x).trim()).filter(Boolean)
        if (Array.isArray(body?.dislikes)) prefs.dislikes = body.dislikes.map((x) => String(x).trim()).filter(Boolean)
        profile.preferences = prefs
        const saved = saveProfile(profile)
        appendLog({ event: 'profile_preferences', intimacy_style: prefs.intimacy_style })
        return sendJson(res, 200, { ok: true, profile: saved })
      }

      if (req.method === 'GET' && api === 'onboarding') {
        return sendJson(res, 200, { ok: true, status: getOnboarding() })
      }

      if (req.method === 'POST' && api === 'onboarding') {
        const body = await readBody(req)
        if (body?.reset) {
          resetOnboarding()
          return sendJson(res, 200, { ok: true, reset: true })
        }
        const result = saveOnboarding(body || {})
        appendLog({ event: 'onboarding_save', skipped: Boolean(body?.skip), wrote: result.wrote })
        return sendJson(res, 200, result)
      }

      if (req.method === 'POST' && api === 'life/validate') {
        const body = await readBody(req)
        const errors = validateLife(lifeOf(body))
        return sendJson(res, 200, { ok: errors.length === 0, errors })
      }

      if (req.method === 'GET' && api === 'ai/schema') {
        return sendJson(res, 200, { ok: true, ...aiSchema() })
      }

      if (req.method === 'GET' && api === 'ai/source') {
        const file = process.env.DSH_HUMANIZER_PERSONA_FILE || path.join(os.homedir(), '.workbuddy', 'SOUL.md')
        try {
          const text = fs.readFileSync(file, 'utf8')
          return sendJson(res, 200, { ok: true, file, text })
        } catch {
          return sendError(res, 404, `人设文件不存在：${file}`)
        }
      }

      if (req.method === 'POST' && api === 'ai/preview') {
        const body = await readBody(req)
        const text = String(body?.text || '')
        if (!text.trim()) return sendError(res, 400, '缺少 text')
        const life = loadLife('mumi')
        const { patch, notes } = derivePatchFromPersona(text, life)
        const next = applyPatchToLife(life, patch)
        const errors = validateLife(next)
        return sendJson(res, 200, { ok: errors.length === 0, patch, notes, errors })
      }

      if (req.method === 'POST' && api === 'ai/apply') {
        const body = await readBody(req)
        const text = String(body?.text || '')
        if (!text.trim()) return sendError(res, 400, '缺少 text')
        const life = loadLife('mumi')
        const { patch, notes } = derivePatchFromPersona(text, life)
        const next = applyPatchToLife(life, patch)
        const result = saveLife('mumi', next)
        const world = getWorld(next, { date: body?.date || todayStr() })
        appendLog({ event: 'ai_apply', notes, patch })
        return sendJson(res, 200, {
          ok: true, patch, notes, life: next, world,
          prompt: buildPrompt(next, world), result
        })
      }

      if (req.method === 'POST' && api === 'ai/patch') {
        const body = await readBody(req)
        const patch = body?.patch || body
        if (!patch || typeof patch !== 'object') return sendError(res, 400, '缺少 patch')
        const life = loadLife('mumi')
        const next = applyPatchToLife(life, patch)
        const errors = validateLife(next)
        if (body?.dry_run) return sendJson(res, 200, { ok: errors.length === 0, errors, life: next })
        if (errors.length) return sendError(res, 422, '配置校验失败', errors)
        const result = saveLife('mumi', next)
        const world = getWorld(next, { date: body?.date || todayStr() })
        appendLog({ event: 'ai_patch', patch })
        return sendJson(res, 200, {
          ok: true, life: next, world, prompt: buildPrompt(next, world), result
        })
      }

      if (req.method === 'GET' && api === 'prompt') {
        const life = loadLife('mumi')
        const world = getWorld(life, { date: url.searchParams.get('date') || todayStr() })
        return sendJson(res, 200, { ok: true, prompt: buildPrompt(life, world) })
      }

      if (req.method === 'GET' && api === 'logs') {
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50))
        return sendJson(res, 200, { ok: true, logs: readLogs(limit) })
      }

      if (req.method === 'POST' && api === 'world/reroll') {
        const body = await readBody(req)
        const date = body?.date || todayStr()
        const life = loadLife('mumi')
        const world = rerollWorld(life, date)
        appendLog({ event: 'reroll', date, epoch: world.epoch })
        return sendJson(res, 200, { ok: true, world })
      }

      if (req.method === 'POST' && api === 'world/lock-event') {
        const body = await readBody(req)
        const { date = todayStr(), event_id: eventId, locked = true } = body || {}
        if (!eventId) return sendError(res, 400, '缺少 event_id')
        const life = loadLife('mumi')
        const world = lockEvent(life, date, eventId, Boolean(locked))
        appendLog({ event: 'lock_event', date, event_id: eventId, locked: Boolean(locked) })
        return sendJson(res, 200, { ok: true, world })
      }

      if (req.method === 'POST' && api === 'world/weather-lock') {
        const body = await readBody(req)
        const { date = todayStr(), weather = null } = body || {}
        const life = loadLife('mumi')
        const world = lockWeather(life, date, weather)
        appendLog({ event: 'lock_weather', date, weather })
        return sendJson(res, 200, { ok: true, world })
      }

      if (req.method === 'POST' && api === 'mood/reset') {
        const body = await readBody(req)
        const life = loadLife('mumi')
        const world = resetMood(life, body?.date || todayStr())
        appendLog({ event: 'mood_reset', date: world.date })
        return sendJson(res, 200, { ok: true, world })
      }

      return sendError(res, 404, `未找到接口：${req.method} ${pathname}`)
    } catch (err) {
      appendLog({ event: 'error', message: String(err && err.message || err), path: pathname })
      if (err && err.code === 'VALIDATION_FAILED') {
        return sendError(res, 422, '配置校验失败', err.details)
      }
      if (err && err.code === 'PAYLOAD_TOO_LARGE') {
        return sendError(res, 413, String(err.message || '请求体过大'))
      }
      return sendError(res, 500, String(err && err.message || err))
    }
  }
}
