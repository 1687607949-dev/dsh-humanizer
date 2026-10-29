import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadProfile, saveProfile } from './userprofile.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.resolve(__dirname, '..', 'data')
const ONBOARD_FILE = path.join(DATA_DIR, 'onboarding.json')
const OVERRIDES_FILE = path.join(DATA_DIR, 'personas', 'mumi', 'persona-overrides.json')

const DEFAULTS = { tone: '原版', initiative: '任务感知', work: '结论优先' }
const QUESTION_IDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9']
const FIELD_MAP = {
  Q1: 'use_cases',
  Q2: 'archetypes',
  Q3: 'interaction_tone',
  Q4: 'language_style',
  Q6: 'visual_aesthetics',
  Q7: 'life_texture',
  Q8: 'relationship_pace',
  Q9: 'work_output'
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function backup(file) {
  if (!fs.existsSync(file)) return null
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  const dest = `${file}.bak_${stamp}`
  fs.copyFileSync(file, dest)
  return dest
}

export function getOnboarding() {
  return readJson(ONBOARD_FILE, { completed: false, skipped: false, answers: {}, persona: { ...DEFAULTS } })
}

export function loadPersonaOverrides() {
  return { ...DEFAULTS, ...(readJson(OVERRIDES_FILE, {}) || {}) }
}

function promptLine(label, value) {
  if (Array.isArray(value) && value.length) return `${label}：${value.join(' / ')}`
  if (typeof value === 'string' && value.trim()) return `${label}：${value.trim()}`
  if (value && typeof value === 'object') {
    const parts = Object.entries(value).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)
    if (parts.length) return `${label}：${parts.join('；')}`
  }
  return ''
}

export function onboardingPrompt(profile = null, overrides = null) {
  const p = profile?.preferences || {}
  const o = overrides || loadPersonaOverrides()
  const weights = profile?.weights && typeof profile.weights === 'object' ? profile.weights : {}
  const core = Object.entries(weights).filter(([, v]) => Number(v) >= 1).map(([k]) => k)
  const lines = [
    promptLine('使用场景', p.use_cases),
    promptLine('性格原型', p.archetypes),
    promptLine('相处氛围', p.interaction_tone),
    promptLine('语言风格', p.language_style),
    promptLine('主动程度', p.initiative_by_context),
    promptLine('视觉偏好', p.visual_aesthetics || p.aesthetics),
    promptLine('生活感', p.life_texture),
    promptLine('关系节奏', p.relationship_pace),
    promptLine('工作输出', p.work_output),
    promptLine('明确雷区', p.boundaries)
  ].filter(Boolean)
  const custom = (p.custom_tags || []).map((t) => (typeof t === 'string' ? t : t?.text)).filter(Boolean)
  if (custom.length) lines.push(`自定义偏好：${custom.slice(0, 6).join(' / ')}`)
  if (core.length) lines.push(`核心偏好：${core.slice(0, 6).join(' / ')}`)
  if (!lines.length && o.tone === '原版' && o.initiative === '任务感知' && o.work === '结论优先') return ''
  return [
    '[用户选择 / 表达权重]',
    ...lines,
    `表达权重：语气 ${o.tone}；主动 ${o.initiative}；工作输出 ${o.work}。`,
    '这些是权重，不是脚本；语气可以随心情浮动，核心身份、外观和边界不变。',
    '未选择的项目不要主动引入；雷区优先于喜好。'
  ].join('\n')
}

export function saveOnboarding(input = {}) {
  const { answers = {}, skip = false } = input
  if (skip) {
    const status = { completed: true, skipped: true, answers: {}, persona: { ...DEFAULTS }, updated_at: new Date().toISOString() }
    fs.mkdirSync(path.dirname(ONBOARD_FILE), { recursive: true })
    fs.writeFileSync(ONBOARD_FILE, JSON.stringify(status, null, 2), 'utf8')
    return { ok: true, status, wrote: [] }
  }

  const wrote = []
  const profile = loadProfile() || { summary: '', traits: [], suggestions: [] }
  const prefs = { ...(profile.preferences || {}) }
  const weights = { ...(profile.weights || {}) }
  const unknown = []
  const customTags = []

  const selectedIds = (qid) => {
    const item = answers[qid]
    if (!item) return []
    if (Array.isArray(item.selected)) return item.selected
    if (Array.isArray(item)) return item
    return []
  }

  for (const [qid, field] of Object.entries(FIELD_MAP)) {
    const item = answers[qid] || {}
    const ids = selectedIds(qid)
    const labels = Array.isArray(item.labels) && item.labels.length ? item.labels : ids
    if (ids.length) {
      prefs[field] = labels
      for (const id of ids) weights[id] = item.core?.includes(id) ? 1 : (weights[id] && weights[id] >= 1 ? 1 : 0.65)
    } else if (!item.status || item.status === 'skipped' || item.status === 'unanswered') {
      unknown.push(qid)
    }
    if (item.custom && String(item.custom).trim()) {
      customTags.push({ q: qid, text: String(item.custom).trim().slice(0, 80) })
    }
  }

  const q5 = answers.Q5 || {}
  const by = q5.by_context || {}
  const labelsBy = q5.labels_by_context || {}
  const active = Object.entries(by).filter(([, v]) => v)
  if (active.length) {
    const ctxLabel = { chat: '闲聊', work: '工作', emotional: '情绪', reminders: '提醒' }
    prefs.initiative_by_context = Object.fromEntries(active.map(([k, v]) => [ctxLabel[k] || k, labelsBy[k] || v]))
    for (const [, id] of active) weights[id] = 0.65
  } else {
    unknown.push('Q5')
  }
  if (q5.custom && String(q5.custom).trim()) {
    customTags.push({ q: 'Q5', text: String(q5.custom).trim().slice(0, 80) })
  }
  if (answers.Q18?.text && String(answers.Q18.text).trim()) {
    customTags.push({ q: 'Q18', text: String(answers.Q18.text).trim().slice(0, 200) })
  }

  prefs.adult_enabled = Boolean(answers.adult_enabled)
  prefs.custom_tags = customTags

  profile.preferences = prefs
  profile.weights = weights
  profile.unknown = { dimensions: [...new Set(unknown)] }

  const profileBackup = backup(path.join(DATA_DIR, 'user-profile.json'))
  saveProfile(profile)
  wrote.push('user-profile.json')

  // 人设权重保持现状；P0 不改 SOUL / preset
  const overrides = loadPersonaOverrides()
  const overrideBackup = backup(OVERRIDES_FILE)
  fs.mkdirSync(path.dirname(OVERRIDES_FILE), { recursive: true })
  fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(overrides, null, 2), 'utf8')
  wrote.push('persona-overrides.json')

  const status = {
    completed: true,
    skipped: false,
    answers,
    weights,
    unknown: profile.unknown,
    persona: overrides,
    updated_at: new Date().toISOString(),
    backups: { profile: profileBackup, overrides: overrideBackup }
  }
  fs.mkdirSync(path.dirname(ONBOARD_FILE), { recursive: true })
  fs.writeFileSync(ONBOARD_FILE, JSON.stringify(status, null, 2), 'utf8')
  wrote.push('onboarding.json')

  return { ok: true, status, wrote }
}

export function resetOnboarding() {
  try { fs.unlinkSync(ONBOARD_FILE) } catch {}
  return { ok: true }
}
