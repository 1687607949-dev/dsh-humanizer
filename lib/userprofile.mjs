import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { affectionStatus } from './affection.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROFILE_FILE = path.resolve(__dirname, '..', 'data', 'user-profile.json')

const STYLE_LABEL = {
  insufficient: '样本不足',
  tool_only: '工具型',
  mixed: '混合型',
  emotional: '情感型'
}

export function profileStats(life, world = null) {
  const a = affectionStatus(life)
  const journal = world?.journal || []
  const manual = journal.filter((x) => x.kind === 'manual')
  const schedule = life.schedule || []
  const lastItem = schedule[schedule.length - 1]
  const lateNight = lastItem && /2[3-9]:|0[0-6]:/.test(lastItem.end || '')
  const likes = (life.preferences?.likes || []).flatMap((x) => x.tags || [])
  const daysSince = a.last_update ? Math.max(0, (Date.now() - Date.parse(a.last_update)) / 86400000) : 0
  return {
    ...a,
    style_label: STYLE_LABEL[a.style] || a.style,
    journal_count: journal.length,
    manual_count: manual.length,
    journal_texts: manual.slice(-10).map((x) => x.text),
    late_night: Boolean(lateNight),
    like_tags: [...new Set(likes)].slice(0, 12),
    days_since_update: Math.round(daysSince * 10) / 10
  }
}

export function draftProfile(stats) {
  const pct = Math.round(stats.ratio * 100)
  const lines = []
  if (stats.style === 'tool_only') {
    lines.push(`目前是工具型使用：情感/日常互动占比 ${pct}%，好感被压在 ${stats.cap} 上限。`)
  } else if (stats.style === 'mixed') {
    lines.push(`混合型使用：情感/日常互动占比 ${pct}%，好感上限 ${stats.cap}。`)
  } else if (stats.style === 'emotional') {
    lines.push(`情感型使用：情感/日常互动占比 ${pct}%，好感上限 ${stats.cap}。`)
  } else {
    lines.push('互动样本还少，暂时只能看出基本使用习惯。')
  }
  lines.push(`今天记了 ${stats.journal_count} 条，内心戏看了 ${stats.counts.inner} 次。`)

  const traits = []
  if (stats.late_night) traits.push('夜猫子')
  if (stats.manual_count >= 2) traits.push('愿意记录生活')
  if (stats.counts.inner >= 2) traits.push('对内心戏好奇')
  if (stats.like_tags.length) traits.push(`知道她喜欢：${stats.like_tags.join(' / ')}`)
  if (!traits.length) traits.push('观察中')

  const suggestions = []
  if (stats.style === 'insufficient') suggestions.push('多聊几次、记两笔，画像才会准。')
  if (stats.style === 'tool_only') suggestions.push('想涨好感，别只在任务时出现：聊两句、看一眼内心戏、记一笔都算。')
  if (stats.cap === 60 && stats.affection >= 58) suggestions.push('好感已经顶到 60 上限了，需要更多日常互动才能突破。')
  if (stats.days_since_update > 2) suggestions.push('有几天没来了，好感在慢慢掉。')
  if (!suggestions.length) suggestions.push('保持现在的节奏就行。')

  return {
    source: 'draft',
    updated_at: new Date().toISOString(),
    style: stats.style,
    style_label: stats.style_label,
    summary: lines.join(' '),
    traits,
    suggestions
  }
}

export function loadProfile() {
  try {
    return JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'))
  } catch {
    return null
  }
}

export function saveProfile(profile) {
  const data = {
    ...profile,
    updated_at: new Date().toISOString()
  }
  fs.mkdirSync(path.dirname(PROFILE_FILE), { recursive: true })
  fs.writeFileSync(PROFILE_FILE, JSON.stringify(data, null, 2), 'utf8')
  return data
}

export function profilePrompt(stats) {
  return [
    '请根据下面的互动统计，写一份“用户画像”，中文，简短：',
    '1. 互动风格（工具型/混合型/情感型）；2. 3~5 个性格标签；3. 2~3 条相处建议。',
    '只写观察，不要编造没发生的事。',
    '',
    JSON.stringify(stats, null, 2)
  ].join('\n')
}
