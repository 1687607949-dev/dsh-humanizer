import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { applyPatchToLife, derivePatchFromPersona } from '../lib/ai.mjs'
import { affectionStatus, recordInteraction, refresh } from '../lib/affection.mjs'
import { draftProfile, loadProfile, profilePrompt, profileStats, saveProfile } from '../lib/userprofile.mjs'
import { todayStr } from '../lib/engine.mjs'
import { appendLog, getWorld, loadLife, saveLife } from '../lib/store.mjs'
import { createWish, fulfillWish } from '../lib/wish.mjs'

const [command, ...args] = process.argv.slice(2)

function readLife() {
  return loadLife('mumi')
}

function summarize(life) {
  return {
    persona: life.profile?.name,
    city: life.profile?.city?.name,
    archetype: life.affection?.archetype,
    affection: life.affection?.affection,
    familiarity: life.affection?.familiarity,
    personality: life.personality,
    style: life.style,
    likes: (life.preferences?.likes || []).map((x) => x.tags.join('/')),
    dislikes: (life.preferences?.dislikes || []).map((x) => x.tags.join('/')),
    events: (life.events || []).length
  }
}

function setPath(target, dotted, value) {
  const keys = dotted.split('.')
  let node = target
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!node[key] || typeof node[key] !== 'object') node[key] = {}
    node = node[key]
  }
  node[keys[keys.length - 1]] = value
}

if (command === 'read') {
  console.log(JSON.stringify(summarize(readLife()), null, 2))
} else if (command === 'persona') {
  const file = args[0]
  if (!file) {
    console.error('用法: node bin/ai.mjs persona <人设文件> [--apply]')
    process.exit(1)
  }
  const text = fs.readFileSync(file, 'utf8')
  const { patch, notes } = derivePatchFromPersona(text, readLife())
  console.log(JSON.stringify({ notes, patch }, null, 2))
  if (args.includes('--apply')) {
    const next = applyPatchToLife(readLife(), patch)
    const result = saveLife('mumi', next)
    appendLog({ event: 'ai_apply_cli', notes, patch })
    console.log('\n已应用:', result.config_hash)
    console.log(JSON.stringify(summarize(next), null, 2))
  }
} else if (command === 'set') {
  const [dotted, raw] = args
  if (!dotted || raw == null) {
    console.error('用法: node bin/ai.mjs set <path> <json值>')
    process.exit(1)
  }
  const life = readLife()
  setPath(life, dotted, JSON.parse(raw))
  saveLife('mumi', life)
  appendLog({ event: 'ai_set_cli', path: dotted, value: JSON.parse(raw) })
  console.log(JSON.stringify(summarize(life), null, 2))
} else if (command === 'patch') {
  const file = args[0]
  if (!file) {
    console.error('用法: node bin/ai.mjs patch <patch.json>')
    process.exit(1)
  }
  const patch = JSON.parse(fs.readFileSync(file, 'utf8'))
  const next = applyPatchToLife(readLife(), patch)
  saveLife('mumi', next)
  appendLog({ event: 'ai_patch_cli', patch })
  console.log(JSON.stringify(summarize(next), null, 2))
} else if (command === 'affection') {
  const life = readLife()
  refresh(life)
  console.log(JSON.stringify(affectionStatus(life), null, 2))
} else if (command === 'interaction') {
  const kind = args[0]
  if (!kind) {
    console.error('用法: node bin/ai.mjs interaction <emotional|inner_peek|journal|task|tool|inappropriate> [备注]')
    process.exit(1)
  }
  const life = readLife()
  refresh(life)
  const result = recordInteraction(life, kind, args.slice(1).join(' '))
  console.log(JSON.stringify(result, null, 2))
} else if (command === 'profile') {
  const file = args[0]
  const life = readLife()
  refresh(life)
  const stats = profileStats(life, getWorld(life, { date: todayStr() }))
  if (file && args.includes('--apply')) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(JSON.stringify(saveProfile(data), null, 2))
  } else {
    console.log(profilePrompt(stats))
    console.log('--- current ---')
    console.log(JSON.stringify(loadProfile() || draftProfile(stats), null, 2))
  }
} else if (command === 'preference') {
  const arg = args[0]
  if (!arg) {
    console.error('用法: node bin/ai.mjs preference <json 或 json 文件>')
    process.exit(1)
  }
  const patch = arg.trim().startsWith('{') ? JSON.parse(arg) : JSON.parse(fs.readFileSync(arg, 'utf8'))
  const profile = loadProfile() || { summary: '', traits: [], suggestions: [] }
  profile.preferences = { ...(profile.preferences || {}), ...patch }
  const saved = saveProfile(profile)
  appendLog({ event: 'ai_preference', patch })
  console.log(JSON.stringify(saved.preferences, null, 2))
} else if (command === 'wish') {
  const life = readLife()
  refresh(life)
  if (args[0] === 'fulfill') {
    const result = fulfillWish(life, args[1])
    if (result.matched) {
      const rec = recordInteraction(life, 'wish')
      console.log(`愿望完成：${result.wish.label}，好感 +${rec.delta}`)
    } else {
      console.log(`没对上：${result.reason || '动作不匹配'}`)
      saveLife(life.persona_id, life)
    }
  } else {
    const wish = createWish(life, getWorld(life, { date: todayStr() }))
    saveLife(life.persona_id, life)
    console.log(`${wish.line}（${wish.label}）`)
  }
} else if (command === 'covers') {
  const file = args[0]
  const target = new URL('../data/covers.json', import.meta.url)
  if (!file) {
    console.log(fs.readFileSync(target, 'utf8'))
  } else {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8')
    appendLog({ event: 'ai_covers', count: Object.values(data).flat().length })
    console.log('封面词库已更新:', fileURLToPath(target))
  }
} else {
  console.log('命令: read | persona <file> [--apply] | set <path> <json> | patch <file> | affection | interaction <kind> | wish [fulfill <act>] | profile [file --apply] | preference <json> | covers [file]')
}
