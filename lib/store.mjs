import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashSeed } from './seed.mjs'
import { computeMood, generateWorld, padBase, todayStr } from './engine.mjs'
import { appendJournal as makeJournalEntry, decorateWorld } from './voice.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PKG_ROOT = path.resolve(__dirname, '..')
export const DATA_DIR = process.env.DSH_HUMANIZER_DATA || path.join(PKG_ROOT, 'data')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJsonAtomic(file, value) {
  ensureDir(path.dirname(file))
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

export function personaDir(personaId = 'mumi') {
  return path.join(DATA_DIR, 'personas', personaId)
}

export function lifePath(personaId = 'mumi') {
  return path.join(personaDir(personaId), 'life.json')
}

export function loadLife(personaId = 'mumi') {
  const file = lifePath(personaId)
  const life = readJson(file)
  if (!life) throw new Error(`life.json 不存在：${file}`)
  return life
}

export function loadArchetypes() {
  return readJson(path.join(DATA_DIR, 'archetypes.json'), { archetypes: {}, tiers: [] })
}

export function configHash(life) {
  const relevant = {
    personality: life.personality,
    preferences: life.preferences,
    events: life.events,
    schedule: life.schedule,
    city: life.profile?.city,
    weather: life.weather,
    locks: life.locks
  }
  return hashSeed(JSON.stringify(relevant)).slice(0, 12)
}

export function validateLife(life) {
  const errors = []
  const push = (p, reason) => errors.push({ path: p, reason })
  if (!life || typeof life !== 'object') return [{ path: '', reason: '不是对象' }]
  if (!life.persona_id) push('persona_id', '必填')
  if (!life.profile?.name) push('profile.name', '必填')
  if (!Array.isArray(life.schedule)) push('schedule', '必须是数组')
  else {
    for (let i = 0; i < life.schedule.length; i++) {
      const s = life.schedule[i]
      if (!/^\d{2}:\d{2}$/.test(s.start || '') || !/^\d{2}:\d{2}$/.test(s.end || '')) {
        push(`schedule[${i}]`, '时间必须是 HH:mm')
      }
      if (!s.activity) push(`schedule[${i}].activity`, '必填')
    }
  }
  const p = life.personality || {}
  for (const key of ['extraversion', 'neuroticism', 'openness', 'agreeableness', 'conscientiousness']) {
    const v = Number(p[key])
    if (!Number.isFinite(v) || v < 0 || v > 1) push(`personality.${key}`, '必须在 0~1')
  }
  const aff = Number(life.affection?.affection)
  if (!Number.isFinite(aff) || aff < -100 || aff > 100) push('affection.affection', '必须在 -100~100')
  const fam = Number(life.affection?.familiarity)
  if (!Number.isFinite(fam) || fam < 0 || fam > 100) push('affection.familiarity', '必须在 0~100')
  if (!Array.isArray(life.events)) push('events', '必须是数组')
  else {
    const ids = new Set()
    for (let i = 0; i < life.events.length; i++) {
      const e = life.events[i]
      if (!e.id) push(`events[${i}].id`, '必填')
      else if (ids.has(e.id)) push(`events[${i}].id`, '重复')
      else ids.add(e.id)
      if (!e.title) push(`events[${i}].title`, '必填')
      const v = Number(e.valence)
      if (!Number.isFinite(v) || v < -1 || v > 1) push(`events[${i}].valence`, '必须在 -1~1')
      const w = Number(e.weight)
      if (!Number.isFinite(w) || w <= 0) push(`events[${i}].weight`, '必须大于 0')
      const it = Number(e.intensity)
      if (!Number.isFinite(it) || it < 0 || it > 1) push(`events[${i}].intensity`, '必须在 0~1')
    }
  }
  for (const [key, list] of [['likes', life.preferences?.likes], ['dislikes', life.preferences?.dislikes]]) {
    if (!Array.isArray(list)) push(`preferences.${key}`, '必须是数组')
    else for (let i = 0; i < list.length; i++) {
      const v = Number(list[i].strength)
      if (!Number.isFinite(v) || v < 0 || v > 1) push(`preferences.${key}[${i}].strength`, '必须在 0~1')
    }
  }
  const style = life.style || {}
  if (style.casual_max_sentences != null && (!Number.isFinite(Number(style.casual_max_sentences)) || Number(style.casual_max_sentences) < 1)) {
    push('style.casual_max_sentences', '必须 ≥ 1')
  }
  return errors
}

export function saveLife(personaId, life) {
  const errors = validateLife(life)
  if (errors.length) {
    const err = new Error('配置校验失败')
    err.code = 'VALIDATION_FAILED'
    err.details = errors
    throw err
  }
  life.schema_version = life.schema_version || '0.1'
  life.persona_id = life.persona_id || personaId
  writeJsonAtomic(lifePath(personaId), life)
  return { ok: true, path: lifePath(personaId), saved_at: new Date().toISOString(), config_hash: configHash(life) }
}

export function worldsDir(personaId = 'mumi') {
  return path.join(DATA_DIR, 'worlds', personaId)
}

export function worldPath(personaId, date) {
  return path.join(worldsDir(personaId), `${date}.json`)
}

export function historyPath(personaId) {
  return path.join(worldsDir(personaId), 'history.json')
}

export function recentEventIds(personaId, date, days = 7) {
  const history = readJson(historyPath(personaId), [])
  const cutoff = new Date(`${date}T00:00:00`).getTime() - days * 86400000
  const ids = []
  for (const item of history) {
    if (item.date === date) continue
    if (new Date(`${item.date}T00:00:00`).getTime() < cutoff) continue
    ids.push(...(item.ids || []))
  }
  return ids
}

function recordHistory(personaId, world) {
  const file = historyPath(personaId)
  const history = readJson(file, [])
  const next = history.filter((x) => x.date !== world.date)
  next.push({ date: world.date, ids: (world.events || []).map((e) => e.id) })
  writeJsonAtomic(file, next.slice(-60))
}

export function getWorld(life, opts = {}) {
  const date = opts.date || todayStr()
  const file = worldPath(life.persona_id, date)
  if (!opts.force) {
    const existing = readJson(file)
    if (existing) {
      if (!Array.isArray(existing.journal)) {
        decorateWorld(existing, life)
        writeJsonAtomic(file, existing)
      }
      // 同一份世界按当前时间重算心情：晚上、深夜、下午会不一样
      try {
        existing.mood = computeMood(life, existing.events || [], existing.mood, opts.now || new Date())
      } catch {}
      return existing
    }
  }
  const world = generateWorld(life, {
    date,
    epoch: opts.epoch ?? 0,
    recentIds: recentEventIds(life.persona_id, date),
    prevMood: opts.prevMood || null,
    configHash: configHash(life),
    now: opts.now || new Date()
  })
  decorateWorld(world, life)
  writeJsonAtomic(file, world)
  recordHistory(life.persona_id, world)
  return world
}

export function saveWorld(world) {
  if (!world || !world.persona_id || !world.date) return world
  writeJsonAtomic(worldPath(world.persona_id, world.date), world)
  return world
}

export function rerollWorld(life, date) {
  const current = getWorld(life, { date })
  const archiveDir = path.join(worldsDir(life.persona_id), 'archive')
  ensureDir(archiveDir)
  writeJsonAtomic(path.join(archiveDir, `${date}-e${current.epoch}.json`), current)
  const next = generateWorld(life, {
    date,
    epoch: Number(current.epoch || 0) + 1,
    recentIds: recentEventIds(life.persona_id, date),
    prevMood: current.mood,
    configHash: configHash(life),
    now: new Date()
  })
  decorateWorld(next, life)
  writeJsonAtomic(worldPath(life.persona_id, date), next)
  recordHistory(life.persona_id, next)
  return next
}

export function appendJournalEntry(life, text, date) {
  const world = getWorld(life, { date: date || todayStr() })
  world.journal = Array.isArray(world.journal) ? world.journal : []
  world.journal.push(makeJournalEntry(life, text))
  writeJsonAtomic(worldPath(life.persona_id, world.date), world)
  return world
}

export function lockEvent(life, date, eventId, locked) {
  const set = new Set(life.locks?.fixed_event_ids || [])
  if (locked) set.add(eventId)
  else set.delete(eventId)
  life.locks = { ...(life.locks || {}), fixed_event_ids: [...set] }
  saveLife(life.persona_id, life)
  const world = getWorld(life, { date })
  world.locked_event_ids = [...set]
  writeJsonAtomic(worldPath(life.persona_id, date), world)
  return world
}

export function lockWeather(life, date, weather) {
  life.weather = { ...(life.weather || {}), locked: weather || null }
  saveLife(life.persona_id, life)
  const current = getWorld(life, { date })
  const next = generateWorld(life, {
    date,
    epoch: Number(current.epoch || 0) + 1,
    recentIds: [],
    prevMood: current.mood,
    configHash: configHash(life),
    now: new Date()
  })
  decorateWorld(next, life)
  writeJsonAtomic(worldPath(life.persona_id, date), next)
  return next
}

export function resetMood(life, date) {
  const world = getWorld(life, { date })
  const base = padBase(life.personality, life.mood?.initial_pad)
  world.mood = {
    pad: base.map((p) => Math.round(p * 100) / 100),
    label: '平静',
    updated_at: new Date().toISOString(),
    base: base.map((p) => Math.round(p * 100) / 100)
  }
  writeJsonAtomic(worldPath(life.persona_id, date), world)
  return world
}

export function appendLog(entry) {
  try {
    const dir = path.join(DATA_DIR, 'logs')
    ensureDir(dir)
    fs.appendFileSync(path.join(dir, 'injection.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n', 'utf8')
  } catch {}
}

export function readLogs(limit = 50) {
  try {
    const file = path.join(DATA_DIR, 'logs', 'injection.jsonl')
    if (!fs.existsSync(file)) return []
    const lines = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
    return lines.slice(-limit).map((l) => {
      try { return JSON.parse(l) } catch { return { raw: l } }
    }).reverse()
  } catch {
    return []
  }
}
