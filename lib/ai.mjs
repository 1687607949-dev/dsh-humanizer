const PROFILES = {
  proud: { extraversion: 0.6, neuroticism: 0.35, openness: 0.8, agreeableness: 0.28, conscientiousness: 0.72 },
  tsundere: { extraversion: 0.55, neuroticism: 0.5, openness: 0.7, agreeableness: 0.4, conscientiousness: 0.6 },
  sharp: { extraversion: 0.5, neuroticism: 0.35, openness: 0.75, agreeableness: 0.2, conscientiousness: 0.65 },
  open: { extraversion: 0.8, neuroticism: 0.3, openness: 0.85, agreeableness: 0.7, conscientiousness: 0.6 },
  gentle: { extraversion: 0.5, neuroticism: 0.3, openness: 0.7, agreeableness: 0.85, conscientiousness: 0.65 },
  lazy: { extraversion: 0.35, neuroticism: 0.35, openness: 0.6, agreeableness: 0.6, conscientiousness: 0.3 }
}

const ARCHETYPE_RULES = [
  ['proud', ['高傲', '高傲型', '看不起', '俯视']],
  ['tsundere', ['傲娇', '口是心非']],
  ['sharp', ['毒舌', '嘴毒', '刻薄']],
  ['open', ['开朗', '外向', '活泼']],
  ['gentle', ['温柔', '体贴', '耐心']],
  ['lazy', ['懒散', '慵懒', '懒']]
]

const LIKE_MAP = [
  ['雨', ['rain', 'quiet']],
  ['咖啡', ['coffee', 'treat']],
  ['猫', ['cat', 'warm']],
  ['游戏', ['game']],
  ['甜', ['treat']],
  ['数据', ['data', 'curiosity']],
  ['安静', ['quiet']],
  ['亲亲', ['warm']],
  ['被夸', ['praise', 'social']]
]

const DISLIKE_MAP = [
  ['噪音', ['noise']],
  ['吵', ['noise']],
  ['排队', ['waiting']],
  ['早起', ['early']],
  ['忽视', ['ignored']],
  ['装修', ['noise', 'annoyance']]
]

function clamp01(n) {
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100))
}

export function derivePatchFromPersona(text, baseLife = null) {
  const src = String(text || '')
  const notes = []
  const patch = {}

  let archetype = null
  for (const [id, words] of ARCHETYPE_RULES) {
    if (words.some((w) => src.includes(w))) {
      archetype = id
      patch.affection = { ...(patch.affection || {}), archetype: id }
      notes.push(`性格底色 → ${id}`)
      break
    }
  }

  const personality = { ...(archetype ? PROFILES[archetype] : (baseLife?.personality || {})) }
  const changedTraits = new Set()
  function bumpTrait(key, delta) {
    personality[key] = clamp01(Number(personality[key] ?? 0.5) + delta)
    changedTraits.add(key)
  }
  const traits = [
    [/高傲|看不起|俯视/, [['agreeableness', -0.1], ['conscientiousness', 0.05]]],
    [/毒舌|嘴毒|刻薄/, [['agreeableness', -0.08]]],
    [/主动|强势|掌控/, [['extraversion', 0.08]]],
    [/温柔|体贴|耐心/, [['agreeableness', 0.1]]],
    [/懒散|慵懒/, [['conscientiousness', -0.08]]],
    [/好奇|兴趣|开放/, [['openness', 0.08]]],
    [/敏感|情绪化|占有欲/, [['neuroticism', 0.08]]],
    [/冷静|理性/, [['neuroticism', -0.08]]]
  ]
  for (const [re, changes] of traits) {
    if (!re.test(src)) continue
    for (const [key, delta] of changes) bumpTrait(key, delta)
  }
  if (archetype || changedTraits.size) {
    patch.personality = personality
    notes.push(`性格基线 → ${Object.entries(patch.personality).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }

  const style = { ...(baseLife?.style || {}) }
  const styleChanged = new Set()
  if (/简短|短句|不超过两句|不废话/.test(src)) { style.casual_max_sentences = 2; styleChanged.add('casual_max_sentences') }
  if (/毒舌|嘴毒|刻薄/.test(src)) { style.profanity = 0.2; styleChanged.add('profanity') }
  if (/主动|强势|掌控/.test(src)) { style.initiative = 0.7; styleChanged.add('initiative') }
  if (/环境|生活|天气|日程/.test(src)) { style.environment_mentions = 0.35; styleChanged.add('environment_mentions') }
  if (styleChanged.size) {
    patch.style = Object.fromEntries([...styleChanged].map((k) => [k, style[k]]))
    notes.push(`表达风格 → ${Object.entries(patch.style).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }

  const likeSentences = src.split(/[。\n]/).filter((s) => s.includes('喜欢'))
  const likes = []
  const seenLike = new Set()
  for (const [word, tags] of LIKE_MAP) {
    if (!likeSentences.some((s) => s.includes(word))) continue
    const key = tags.join('|')
    if (seenLike.has(key)) continue
    seenLike.add(key)
    likes.push({ id: `like_${tags.join('_')}`, tags, strength: 0.7 })
  }

  const dislikeSentences = src.split(/[。\n]/).filter((s) => /讨厌|不喜欢|受不了|烦/.test(s))
  const dislikes = []
  const seenDislike = new Set()
  for (const [word, tags] of DISLIKE_MAP) {
    if (!dislikeSentences.some((s) => s.includes(word))) continue
    const key = tags.join('|')
    if (seenDislike.has(key)) continue
    seenDislike.add(key)
    dislikes.push({ id: `dislike_${tags.join('_')}`, tags, strength: 0.7 })
  }

  if (likes.length || dislikes.length) {
    patch.preferences = {}
    if (likes.length) patch.preferences.likes = likes
    if (dislikes.length) patch.preferences.dislikes = dislikes
    notes.push(`偏好 → 喜欢 ${likes.length} 条 / 讨厌 ${dislikes.length} 条`)
  }

  return { patch, notes }
}

function mergePrefs(current = [], incoming = []) {
  const byKey = new Map()
  for (const item of current || []) byKey.set((item.tags || []).join('|'), item)
  for (const item of incoming || []) byKey.set((item.tags || []).join('|'), item)
  return [...byKey.values()]
}

export function applyPatchToLife(life, patch) {
  const next = structuredClone(life)
  if (patch.profile) {
    next.profile = next.profile || {}
    if (patch.profile.name) next.profile.name = patch.profile.name
    if (patch.profile.identity) next.profile.identity = patch.profile.identity
    if (patch.profile.city) next.profile.city = { ...(next.profile.city || {}), ...patch.profile.city }
    if (patch.profile.residence) next.profile.residence = { ...(next.profile.residence || {}), ...patch.profile.residence }
  }
  if (patch.personality) next.personality = { ...(next.personality || {}), ...patch.personality }
  if (patch.style) next.style = { ...(next.style || {}), ...patch.style }
  if (patch.affection) next.affection = { ...(next.affection || {}), ...patch.affection }
  if (patch.preferences) {
    next.preferences = next.preferences || {}
    if (patch.preferences.likes) next.preferences.likes = mergePrefs(next.preferences.likes, patch.preferences.likes)
    if (patch.preferences.dislikes) next.preferences.dislikes = mergePrefs(next.preferences.dislikes, patch.preferences.dislikes)
  }
  if (patch.events) next.events = patch.events
  if (patch.schedule) next.schedule = patch.schedule
  return next
}

export function aiSchema() {
  return {
    editable: [
      'profile.name',
      'profile.identity',
      'profile.city.name',
      'profile.city.climate_zone',
      'profile.residence.type',
      'profile.residence.description',
      'personality.extraversion',
      'personality.neuroticism',
      'personality.openness',
      'personality.agreeableness',
      'personality.conscientiousness',
      'style.enabled',
      'style.casual_max_sentences',
      'style.profanity',
      'style.initiative',
      'style.environment_mentions',
      'affection.archetype',
      'affection.affection',
      'affection.familiarity',
      'preferences.likes',
      'preferences.dislikes',
      'events',
      'schedule'
    ],
    archetypes: ['proud', 'open', 'tsundere', 'gentle', 'lazy', 'sharp'],
    ranges: {
      'personality.*': [0, 1],
      'affection.affection': [-100, 100],
      'affection.familiarity': [0, 100],
      'style.casual_max_sentences': [1, 6],
      'style.profanity': [0, 1],
      'style.initiative': [0, 1],
      'style.environment_mentions': [0, 1]
    }
  }
}
