import { clamp, hashSeed, pick, rngFrom, round, weightedPick } from './seed.mjs'

const CLIMATES = {
  humid_subtropical: {
    spring: { temp: [14, 24], conditions: [['多云', 4], ['小雨', 3], ['晴', 2], ['阴', 2]] },
    summer: { temp: [25, 35], conditions: [['晴', 3], ['多云', 3], ['阵雨', 3], ['雷阵雨', 2]] },
    autumn: { temp: [16, 26], conditions: [['晴', 3], ['多云', 3], ['小雨', 2], ['阴', 2]] },
    winter: { temp: [4, 12], conditions: [['阴', 4], ['小雨', 3], ['多云', 2], ['晴', 1]] }
  },
  temperate: {
    spring: { temp: [8, 20], conditions: [['晴', 4], ['多云', 3], ['小雨', 2]] },
    summer: { temp: [20, 31], conditions: [['晴', 4], ['多云', 3], ['阵雨', 2]] },
    autumn: { temp: [8, 21], conditions: [['晴', 3], ['多云', 3], ['小雨', 2], ['阴', 1]] },
    winter: { temp: [-6, 6], conditions: [['晴', 3], ['阴', 3], ['小雪', 2]] }
  },
  cold: {
    spring: { temp: [0, 12], conditions: [['多云', 4], ['阴', 3], ['小雨', 1]] },
    summer: { temp: [12, 24], conditions: [['晴', 3], ['多云', 4], ['阵雨', 2]] },
    autumn: { temp: [-2, 10], conditions: [['阴', 4], ['多云', 3], ['小雨', 1]] },
    winter: { temp: [-18, -2], conditions: [['小雪', 3], ['阴', 4], ['晴', 1]] }
  }
}

const LABELS = ['开心', '兴奋', '平静', '烦躁', '低落']

const ALLOWED = {
  低落: ['平静'],
  平静: ['低落', '开心', '烦躁'],
  开心: ['平静', '兴奋', '烦躁'],
  兴奋: ['开心', '平静'],
  烦躁: ['平静', '低落', '开心']
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function weekdayCN(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  return `周${'日一二三四五六'[d.getDay()]}`
}

export function seasonOf(dateStr) {
  const month = Number(dateStr.slice(5, 7))
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function padBase(personality = {}, initial = [0, 0, 0]) {
  const E = Number(personality.extraversion ?? 0.5)
  const N = Number(personality.neuroticism ?? 0.4)
  const C = Number(personality.conscientiousness ?? 0.5)
  return [
    clamp(-0.15 + 0.3 * E - 0.15 * N + Number(initial[0] || 0), -1, 1),
    clamp(-0.15 + 0.2 * E + 0.15 * N + Number(initial[1] || 0), -1, 1),
    clamp(-0.1 + 0.3 * C - 0.2 * N + Number(initial[2] || 0), -1, 1)
  ]
}

export function weatherFor(life, rng, dateStr) {
  const locked = life?.weather?.locked
  if (locked && typeof locked === 'object') {
    return { ...locked, source: 'locked' }
  }
  const zone = life?.profile?.city?.climate_zone || 'humid_subtropical'
  const table = CLIMATES[zone] || CLIMATES.humid_subtropical
  const season = table[seasonOf(dateStr)] || table.autumn
  const condition = weightedPick(rng, season.conditions, (x) => x[1])[0]
  const [lo, hi] = season.temp
  const temp = Math.round(lo + rng() * (hi - lo))
  return { condition, temperature_c: temp, source: 'synthetic', climate_zone: zone }
}

function eventAppraisal(event, life) {
  const tags = Array.isArray(event.tags) ? event.tags : []
  let like = 0
  let dislike = 0
  for (const l of life.preferences?.likes || []) {
    if ((l.tags || []).some((t) => tags.includes(t))) like = Math.max(like, Number(l.strength) || 0)
  }
  for (const d of life.preferences?.dislikes || []) {
    if ((d.tags || []).some((t) => tags.includes(t))) dislike = Math.max(dislike, Number(d.strength) || 0)
  }
  const N = Number(life.personality?.neuroticism ?? 0.4)
  let factor = 1 + 0.6 * like - 0.6 * dislike
  if (Number(event.valence) < 0) factor *= 1 + 0.4 * N
  const intensity = Number(event.intensity ?? 0.4)
  const certainty = Number(event.certainty ?? 0.6)
  const control = Number(event.control ?? (Number(event.valence) >= 0 ? 0.6 : 0.3))
  const bias = Array.isArray(event.mood_bias)
    ? event.mood_bias
    : [Number(event.valence) * 0.35, Math.abs(Number(event.valence)) * 0.12, Number(event.valence) * 0.08]
  // OCC/Scherer 式评价维度：确定性影响唤醒，控制感影响掌控感
  const scaled = [
    Number(bias[0]),
    Number(bias[1]) + (certainty - 0.5) * 0.12,
    Number(bias[2]) + (control - 0.5) * 0.2
  ]
  return scaled.map((b) => b * intensity * factor * 0.5)
}

export function chooseEvents(life, rng, recentIds = []) {
  const pool = Array.isArray(life.events) ? life.events.filter((e) => e && e.id) : []
  const locked = new Set(life.locks?.fixed_event_ids || [])
  const chosen = []
  for (const id of locked) {
    const ev = pool.find((e) => e.id === id)
    if (ev) chosen.push({ ...ev, locked: true })
  }

  const candidates = pool.filter((e) => {
    if (chosen.some((c) => c.id === e.id)) return false
    if (locked.has(e.id)) return false
    if (e.rarity === 'rare') return rng() < 0.02
    if (e.rarity === 'uncommon') return rng() < 0.12
    if (e.rarity === 'special') return false
    return true
  })

  const target = 3 + Math.floor(rng() * 4)
  while (chosen.length < target && candidates.length) {
    const ev = weightedPick(rng, candidates, (e) => {
      const base = Number(e.weight ?? 1)
      return recentIds.includes(e.id) ? base * 0.4 : base
    })
    if (!ev) break
    chosen.push({ ...ev, locked: false })
    const idx = candidates.indexOf(ev)
    if (idx >= 0) candidates.splice(idx, 1)
  }

  return chosen.map((e) => {
    const [a, b] = e.time_window || ['08:00', '22:00']
    const start = toMinutes(a)
    const end = Math.max(start + 30, toMinutes(b))
    const minute = Math.round(start + rng() * (end - start))
    return { ...e, time: fromMinutes(minute) }
  }).sort((x, y) => x.time.localeCompare(y.time))
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

function fromMinutes(min) {
  const h = Math.floor(min / 60) % 24
  const m = Math.round(min % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function labelFromPad(pad, prevLabel, rng) {
  const [P, A, D] = pad
  const scores = {
    开心: P * 1.2 + A * 0.4,
    兴奋: P * 1.0 + A * 1.2,
    烦躁: -P * 1.2 + A * 0.8 - D * 0.2,
    低落: -P * 1.0 - D * 0.6 - A * 0.3,
    平静: -Math.abs(P) * 0.8 - Math.abs(A) * 0.5 + 0.2
  }
  const allowed = prevLabel ? ALLOWED[prevLabel] || LABELS : LABELS
  let pool = LABELS.filter((l) => allowed.includes(l))
  // 语义一致性闸门：PAD 不允许出现“正愉悦却低落”“负愉悦却兴奋”这种标签
  if (P > 0.1) pool = pool.filter((l) => l !== '低落')
  if (P < -0.1) pool = pool.filter((l) => l !== '兴奋' && l !== '开心')
  if (A < 0.15) pool = pool.filter((l) => l !== '兴奋')
  if (P >= 0.05) pool = pool.filter((l) => l !== '烦躁')
  if (P <= -0.05) pool = pool.filter((l) => l !== '开心')
  if (!pool.length) pool = ['平静']
  const vals = pool.map((l) => scores[l])
  const max = Math.max(...vals)
  const exps = vals.map((v) => Math.exp((v - max) / 0.6))
  const sum = exps.reduce((a, b) => a + b, 0)
  let r = rng() * sum
  for (let i = 0; i < pool.length; i++) {
    r -= exps[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

export function circadianBias(now = new Date()) {
  const h = now.getHours()
  if (h < 6) return [-0.06, -0.12, -0.06]   // 深夜：低能量、低掌控
  if (h < 9) return [0.03, 0.05, 0.02]      // 早晨：慢慢醒
  if (h < 12) return [0.04, 0.08, 0.05]     // 上午：状态最好
  if (h < 14) return [0, 0.02, 0]           // 中午：平
  if (h < 18) return [-0.04, -0.09, -0.03]  // 下午：工作枯燥期
  if (h < 22) return [0.05, 0.02, 0.04]     // 晚上：回温
  return [-0.02, -0.04, -0.02]              // 深夜前段
}

export function computeMood(life, events, prev, now = new Date()) {
  const base = padBase(life.personality, life.mood?.initial_pad)
  const decayHours = Number(life.mood?.decay_hours ?? 8)
  const prevPad = Array.isArray(prev?.pad) ? prev.pad : base
  const prevTime = prev?.updated_at ? Date.parse(prev.updated_at) : now.getTime()
  const hours = Math.max(0, (now.getTime() - prevTime) / 3600000)
  const decayed = prevPad.map((p, i) => base[i] + (p - base[i]) * Math.exp(-hours / decayHours))

  const sum = [0, 0, 0]
  for (const ev of events) {
    const d = eventAppraisal(ev, life)
    for (let i = 0; i < 3; i++) sum[i] += d[i]
  }
  const timeBias = circadianBias(now)
  const target = base.map((b, i) => clamp(b + sum[i] / Math.max(1, events.length * 0.8) + timeBias[i], -1, 1))
  const alpha = 0.25
  let next = decayed.map((p, i) => p + (target[i] - p) * alpha)
  const maxDelta = 0.25
  next = next.map((p, i) => clamp(p, prevPad[i] - maxDelta, prevPad[i] + maxDelta))
  next = next.map((p) => clamp(p, -1, 1))

  const rng = rngFrom(hashSeed(life.persona_id || 'persona', todayStr(now), String(events.length), String(now.getHours())))
  const label = labelFromPad(next, prev?.label, rng)
  return {
    pad: next.map((p) => round(p, 2)),
    label,
    updated_at: now.toISOString(),
    base: base.map((p) => round(p, 2))
  }
}

export function interactionMoodDelta(kind, note = '') {
  const text = String(note || '')
  const positive = /喜欢|开心|可爱|谢谢|亲|抱|夸|爱|好棒|厉害|舒服/.test(text)
  const negative = /烦|累|滚|讨厌|难过|生气|不想|别烦|难受/.test(text)
  if (kind === 'tool' || kind === 'task') return [-0.05, -0.12, -0.02]
  if (kind === 'wish') return [0.14, 0.08, 0.03]
  if (kind === 'inappropriate') return [-0.20, 0.12, -0.05]
  if (kind === 'journal') return [0.03, 0.01, 0]
  if (kind === 'emotional') {
    if (positive) return [0.12, 0.05, 0.02]
    if (negative) return [-0.14, 0.10, -0.03]
    return [0.02, 0.01, 0]
  }
  return [0, 0, 0]
}

export function applyInteractionMood(world, kind, note = '', now = new Date()) {
  if (!world?.mood?.pad) return world?.mood || null
  const d = interactionMoodDelta(kind, note)
  const pad = world.mood.pad.map((p, i) => clamp(Number(p) + d[i], -1, 1)).map((p) => round(p, 2))
  const rng = rngFrom(hashSeed(world.date || todayStr(now), kind, String(now.getTime())))
  world.mood = {
    ...world.mood,
    pad,
    label: labelFromPad(pad, world.mood.label, rng),
    updated_at: now.toISOString(),
    source: 'interaction'
  }
  return world.mood
}

export function getActivity(life, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes()
  for (const item of life.schedule || []) {
    const start = toMinutes(item.start)
    const end = toMinutes(item.end)
    if (start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end) {
      return item.activity
    }
  }
  return '发呆'
}

export function daypart(now = new Date()) {
  const h = now.getHours()
  if (h < 6) return '深夜'
  if (h < 9) return '早晨'
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 18) return '下午'
  if (h < 22) return '晚上'
  return '深夜'
}

export function generateWorld(life, opts = {}) {
  const date = opts.date || todayStr()
  const epoch = Number(opts.epoch ?? 0)
  const configHash = opts.configHash || 'v0'
  const seed = hashSeed(life.persona_id || 'persona', date, String(epoch), configHash)
  const rng = rngFrom(seed)
  const weather = weatherFor(life, rng, date)
  const events = chooseEvents(life, rng, opts.recentIds || [])
  const now = opts.now || new Date()
  const mood = computeMood(life, events, opts.prevMood || null, now)
  return {
    schema_version: '0.1',
    persona_id: life.persona_id,
    date,
    epoch,
    world_seed: seed.slice(0, 16),
    config_hash: configHash,
    weather,
    events,
    mood,
    locked_event_ids: [...(life.locks?.fixed_event_ids || [])],
    generated_at: now.toISOString()
  }
}

export function tierFor(affection, tiers) {
  const value = Number(affection ?? 0)
  return tiers.find((t) => value >= t.min && value < t.max) || tiers[tiers.length - 1]
}

export function expressionPreview(archetypes, archetypeId, affection) {
  const a = archetypes?.archetypes?.[archetypeId] || archetypes?.archetypes?.proud
  if (!a) return { tier: null, line: '', refusal: '' }
  const tier = tierFor(affection, archetypes.tiers || [])
  const key = tier?.id || 'known'
  const refusalKey = Number(affection) >= 70 ? 'high' : 'low'
  return {
    tier,
    line: a.lines?.[key] || '',
    refusal: a.refusal?.[refusalKey] || ''
  }
}

export function buildPrompt(life, world, extra = '', now = new Date()) {
  const name = life.profile?.name || '角色'
  const city = life.profile?.city?.name || '某地'
  const residence = life.profile?.residence?.type || '住处'
  const activity = getActivity(life, now)
  const events = (world.events || []).map((e) => `${e.time} ${e.title}`).join('；') || '今天暂时没什么特别的事'
  const mood = world.mood || { label: '平静', pad: [0, 0, 0] }
  const style = life.style || {}
  const lines = [
    '[最高优先级：角色状态]',
    '下面是当前角色状态的最终依据。与其他角色/风格提示冲突时，以本段为准；工作/技术任务的正确性优先于语气。',
    '[角色生活状态]',
    `角色：${name}；日期：${world.date} ${weekdayCN(world.date)}；时段：${daypart(now)}；此刻：${activity}。`,
    `环境：${city}·${world.weather?.condition || '阴'} ${world.weather?.temperature_c ?? '?'}℃；住处：${residence}。`,
    `今日事件：${events}。`,
    `心情：${mood.label}（P=${mood.pad?.[0] ?? 0}, A=${mood.pad?.[1] ?? 0}, D=${mood.pad?.[2] ?? 0}）。`,
    '[表达规则]',
    `闲聊默认不超过 ${style.casual_max_sentences ?? 2} 句，口语化，允许情绪和主动表达；不要客服腔、总结式开头、编号列表。`,
    `工作/技术回复不限长度，情绪最多出现在开头一句；代码、命令、路径、表格、报错原文一个字都不改。`
  ]
  const text = lines.join('\n')
  return extra ? `${text}\n${extra}` : text
}
