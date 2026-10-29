import { todayStr } from './engine.mjs'
import { loadLife, saveLife } from './store.mjs'

const GAINS = {
  emotional: 1.2,
  inner_peek: 0,
  wish: 2.0,
  journal: 0.4,
  task: 0.6,
  tool: 0.3,
  inappropriate: -12
}

// 每天最多涨多少：前期约 5.5/天，熟悉后越来越慢
const DAILY_CAPS = [
  { max: 45, cap: 5.5 },
  { max: 70, cap: 3.5 },
  { max: 90, cap: 2 },
  { max: 100, cap: 1 }
]

const INITIAL_AFFECTION = 10
const INITIAL_FAMILIARITY = 0

export function dailyCapFor(a) {
  const aff = Number(a?.affection ?? 0)
  for (const row of DAILY_CAPS) {
    if (aff < row.max) return row.cap
  }
  return 1
}

export function ensureState(life) {
  const a = life.affection || (life.affection = {})
  a.affection = Number(a.affection ?? INITIAL_AFFECTION)
  a.familiarity = Number(a.familiarity ?? INITIAL_FAMILIARITY)
  a.archetype = a.archetype || 'proud'
  a.last_update = a.last_update || new Date().toISOString()
  a.history = Array.isArray(a.history) ? a.history : []
  a.counts = {
    emotional: 0, tool: 0, task: 0, journal: 0, inner: 0, inappropriate: 0,
    ...(a.counts || {})
  }
  a.daily = a.daily && typeof a.daily === 'object' ? a.daily : {}
  return a
}

function totalInteractions(a) {
  const emo = a.counts.emotional + a.counts.journal + a.counts.inner
  const tool = a.counts.tool + a.counts.task
  return emo + tool
}

export function emotionalRatio(a) {
  const emo = a.counts.emotional + a.counts.journal + a.counts.inner
  const total = totalInteractions(a)
  return total ? emo / total : 0
}

export function capFor(a) {
  const total = totalInteractions(a)
  if (total < 8) return 60
  const r = emotionalRatio(a)
  if (r < 0.15) return 60
  if (r < 0.30) return 80
  return 100
}

function pushHistory(a, entry) {
  a.history.push({ ts: new Date().toISOString(), ...entry })
  if (a.history.length > 240) a.history = a.history.slice(-240)
}

export function applyDecay(life, now = new Date()) {
  const a = ensureState(life)
  const cap = capFor(a)
  const before = a.affection
  let delta = 0

  // 上限掉下来时，立即把超出的部分收回去，避免出现“68/上限60”
  if (a.affection > cap) {
    delta += cap - a.affection
    a.affection = cap
  }

  const last = Date.parse(a.last_update)
  const hours = Number.isFinite(last) ? (now.getTime() - last) / 3600000 : 0
  if (hours >= 1) {
    const days = hours / 24
    const rate = days < 3 ? 0.4 : days < 7 ? 0.8 : 1.2
    const decay = -rate * days
    a.affection = Math.round(Math.max(0, Math.min(100, a.affection + decay)) * 100) / 100
    delta += a.affection - (before + (delta || 0))
    a.last_update = now.toISOString()
  }

  if (Math.abs(delta) >= 0.01) {
    pushHistory(a, { kind: 'decay', delta, value: a.affection })
  }
  return { changed: Math.abs(delta) >= 0.01, delta, cap }
}

export function refresh(life) {
  const result = applyDecay(life)
  if (result.changed) saveLife(life.persona_id, life)
  return result
}

function dayBucket(a, date = todayStr()) {
  a.daily[date] = a.daily[date] || {}
  return a.daily[date]
}

export function recordInteraction(life, kind, note = '') {
  const a = ensureState(life)
  applyDecay(life)

  const before = a.affection
  const cap = capFor(a)
  const day = dayBucket(a)
  let gain = GAINS[kind] ?? 0
  if (!day.any && kind !== 'inappropriate') gain += 0.5

  if (kind === 'inner_peek') {
    // 点开内心戏本身不加好感；要等她想要的行动真的发生
    a.last_update = new Date().toISOString()
    saveLife(life.persona_id, life)
    return {
      ok: true,
      kind,
      before: Math.round(before * 100) / 100,
      after: Math.round(before * 100) / 100,
      delta: 0,
      cap,
      ratio: Math.round(emotionalRatio(a) * 100) / 100,
      style: styleOf(a),
      reason: '点开不算，完成她想要的才算'
    }
  }

  if (kind !== 'inappropriate') {
    const diminish = 0.5 + 0.5 * (1 - Math.min(1, a.affection / 100))
    const capToday = dailyCapFor(a)
    const used = Number(day.gain || 0)
    gain *= diminish
    gain = Math.min(gain, Math.max(0, capToday - used))
    if (gain <= 0) {
      a.last_update = new Date().toISOString()
      saveLife(life.persona_id, life)
      return {
        ok: true,
        kind,
        before: Math.round(before * 100) / 100,
        after: Math.round(before * 100) / 100,
        delta: 0,
        cap,
        ratio: Math.round(emotionalRatio(a) * 100) / 100,
        style: styleOf(a),
        reason: '今天的好感已经涨到上限，明天再来'
      }
    }
    a.affection = Math.round(Math.min(cap, a.affection + gain) * 100) / 100
    day.gain = used + Math.max(0, a.affection - before)
  } else {
    a.affection = Math.round(Math.max(0, a.affection + gain) * 100) / 100
  }

  if (kind === 'emotional' || kind === 'wish') a.counts.emotional += 1
  else if (kind === 'journal') a.counts.journal += 1
  else if (kind === 'inner_peek') a.counts.inner += 1
  else if (kind === 'task') a.counts.task += 1
  else if (kind === 'tool') a.counts.tool += 1
  else if (kind === 'inappropriate') a.counts.inappropriate += 1

  day.any = true
  a.last_update = new Date().toISOString()
  pushHistory(a, { kind, delta: a.affection - before, value: a.affection, note })
  saveLife(life.persona_id, life)

  return {
    ok: true,
    kind,
    before: Math.round(before * 100) / 100,
    after: Math.round(a.affection * 100) / 100,
    delta: Math.round((a.affection - before) * 100) / 100,
    cap,
    ratio: Math.round(emotionalRatio(a) * 100) / 100,
    style: styleOf(a)
  }
}

export function styleOf(a) {
  const r = emotionalRatio(a)
  if (totalInteractions(a) < 8) return 'insufficient'
  if (r < 0.15) return 'tool_only'
  if (r < 0.30) return 'mixed'
  return 'emotional'
}

export function affectionStatus(life) {
  const a = ensureState(life)
  const cap = capFor(a)
  const style = styleOf(a)
  const day = a.daily?.[todayStr()] || {}
  return {
    affection: Math.round(a.affection * 100) / 100,
    familiarity: a.familiarity,
    cap,
    daily_cap: dailyCapFor(a),
    today_gain: Math.round(Number(day.gain || 0) * 100) / 100,
    ratio: Math.round(emotionalRatio(a) * 100) / 100,
    style,
    counts: a.counts,
    last_update: a.last_update,
    daily: a.daily,
    recent: a.history.slice(-20).reverse()
  }
}

export function loadAndRefresh() {
  const life = loadLife('mumi')
  refresh(life)
  return life
}
