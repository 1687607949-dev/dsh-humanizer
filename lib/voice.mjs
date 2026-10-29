import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashSeed } from './seed.mjs'
import { daypart, getActivity, tierFor, weekdayCN } from './engine.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const COVERS_FILE = path.join(__dirname, '..', 'data', 'covers.json')
let coversCache = null
let coversMtime = 0

function aiCovers(arch) {
  try {
    const st = fs.statSync(COVERS_FILE)
    if (st.mtimeMs !== coversMtime) {
      coversCache = JSON.parse(fs.readFileSync(COVERS_FILE, 'utf8'))
      coversMtime = st.mtimeMs
    }
    const list = coversCache?.[arch]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const VIEWS = {
  proud: {
    low: '一个还算有点用的观察对象。别自作多情。',
    mid: '……勉强算个熟人。别指望本小姐对你客气。',
    high: '自己人。别到处说，尤其别跟别人说本小姐对你好。'
  },
  open: {
    low: '新认识的人，看起来还挺有意思。',
    mid: '聊得来的朋友，今天也想跟你多说两句。',
    high: '很重要的人。你一来，本小姐心情就好了。'
  },
  sharp: {
    low: '一个需要观察的对象。别靠太近。',
    mid: '还算顺眼的熟人。可以少损两句。',
    high: '……自己人。嘴上不饶你，心里有数。'
  },
  gentle: {
    low: '一个需要慢慢了解的人。',
    mid: '可以放心说话的人。',
    high: '想一直照顾的人。'
  },
  lazy: {
    low: '一个不算麻烦的人。',
    mid: '可以一起躺着的人。',
    high: '……愿意为你起身的人。'
  },
  tsundere: {
    low: '谁、谁要特别看你啊。',
    mid: '勉强算朋友。别误会。',
    high: '……很重要的人。才、才不告诉你。'
  }
}

const REACTIONS = {
  proud: {
    positive: ['哼，算你有点眼光。', '……还行吧，勉强合格。', '别得意，下次未必。'],
    negative: ['啧，麻烦。', '……就这？', '别指望本小姐安慰你。'],
    neutral: ['姆。知道了。', '……然后呢？', '说重点。']
  },
  open: {
    positive: ['哇，这个好！', '听起来不错啊。', '嘿嘿，我也这么觉得。'],
    negative: ['啊……好倒霉。', '抱抱，别难受。', '要不先歇会儿？'],
    neutral: ['然后呢？', '我在听。', '说说看。']
  },
  sharp: {
    positive: ['哟，今天脑子在线。', '难得，没犯蠢。', '……还行，比上次强。'],
    negative: ['这都能碰上，服了。', '……你运气真差。', '需要我骂它两句吗。'],
    neutral: ['说重点。', '……所以？', '继续。']
  },
  gentle: {
    positive: ['真好。', '听起来就很开心。', '辛苦啦。'],
    negative: ['辛苦了。', '先别急，慢慢来。', '要不要先喝点水？'],
    neutral: ['嗯，我在听。', '慢慢说。', '然后呢？']
  },
  lazy: {
    positive: ['姆……不错。', '还行，继续。', '懒得夸你，但确实可以。'],
    negative: ['姆……好麻烦。', '算了，躺会儿再说。', '别想了，先歇着。'],
    neutral: ['姆。', '……嗯。', '说。']
  },
  tsundere: {
    positive: ['才、才没有很高兴呢。', '……一般般吧。', '哼，算你厉害。'],
    negative: ['……真拿你没办法。', '谁、谁担心你了。', '下次小心点。'],
    neutral: ['……干嘛。', '说清楚。', '哼。']
  }
}

const CARE = {
  proud: '……别误会，本小姐只是顺手。',
  open: '下次也跟我说啊。',
  sharp: '……看什么看，又不是特意为你。',
  gentle: '有事要告诉我。',
  lazy: '……记得吃饭。',
  tsundere: '才、才不是担心你。'
}

const COVER_PARTS = {
  proud: {
    prefix: ['喂，', '哼，', '……'],
    core: ['谁准你偷看的', '看了要负责的', '想知道就自己来问我', '别偷偷摸摸的', '本小姐的内心是随便看的？'],
    tail: ['。', '，懂？', '……笨蛋。']
  },
  tsundere: {
    prefix: ['不、不准看！', '谁、谁让你看了！', '……'],
    core: ['看了也不许笑', '看完就忘掉', '才不是写给你的', '只是随便写写'],
    tail: ['。', '……哼。', '啦。']
  },
  open: {
    prefix: ['喂喂，', '诶，', '……'],
    core: ['不准偷看啦', '想看就光明正大地看', '偷偷摸摸的干什么', '先陪我聊两句'],
    tail: ['。', '嘛。', '！']
  },
  gentle: {
    prefix: ['那个……', '嗯……', '……'],
    core: ['还是不要看比较好', '会有点不好意思', '等我想好再给你看', '没什么好看的啦'],
    tail: ['。', '，好吗？', '……']
  },
  lazy: {
    prefix: ['姆……', '……', '喂，'],
    core: ['别吵', '看了要负责的', '好麻烦，别看', '让本小姐再躺会儿'],
    tail: ['。', '……', '啦。']
  },
  sharp: {
    prefix: ['看什么看，', '喂，', '……'],
    core: ['手别乱翻', '看了要付代价的', '谁准你翻的', '想知道就开口问'],
    tail: ['。', '？', '……']
  }
}

export function generateCover(life) {
  const arch = life.affection?.archetype || 'proud'
  const covers = aiCovers(arch)
  if (covers.length) return covers[Math.floor(Math.random() * covers.length)]
  const p = COVER_PARTS[arch] || COVER_PARTS.proud
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  return `${pick(p.prefix)}${pick(p.core)}${pick(p.tail)}`
}

export function affectionLevel(affection) {
  const n = Number(affection ?? 0)
  if (n < 45) return 'low'
  if (n < 70) return 'mid'
  return 'high'
}

export function viewFor(life) {
  const arch = life.affection?.archetype || 'proud'
  const level = affectionLevel(life.affection?.affection)
  return VIEWS[arch]?.[level] || VIEWS.proud.low
}

export function reactionFor(life, entry) {
  const arch = life.affection?.archetype || 'proud'
  const valence = Number(entry?.valence ?? 0)
  const kind = valence > 0.15 ? 'positive' : valence < -0.15 ? 'negative' : 'neutral'
  const list = REACTIONS[arch]?.[kind] || REACTIONS.proud.neutral
  const seed = hashSeed(life.persona_id || 'p', entry?.text || '', entry?.time || '')
  const line = list[parseInt(seed.slice(0, 4), 16) % list.length]
  const aff = Number(life.affection?.affection ?? 0)
  if (aff >= 70 && kind === 'negative') return `${line} ${CARE[arch] || ''}`.trim()
  if (aff >= 70 && kind === 'positive' && (parseInt(seed.slice(4, 6), 16) % 2 === 0)) return `${line} ${CARE[arch] || ''}`.trim()
  return line
}

export function decorateWorld(world, life) {
  if (!Array.isArray(world.journal)) world.journal = []
  if (world.journal.length) return world
  world.journal = (world.events || []).map((e) => ({
    time: e.time,
    text: e.title,
    valence: Number(e.valence ?? 0),
    kind: 'event',
    reaction: reactionFor(life, e)
  }))
  return world
}

export function inferValence(text) {
  const s = String(text || '')
  if (/修好|完成|成功|通过|赢了|被夸|开心|顺利|搞定|跑通|解决|上线/.test(s)) return 0.5
  if (/失败|坏了|崩了|被骂|挨骂|骂|烦|累|丢了|出错|迟到|排队/.test(s)) return -0.5
  return 0
}

export function appendJournal(life, text, time) {
  const valence = inferValence(text)
  return {
    time: time || new Date().toTimeString().slice(0, 5),
    text: String(text || '').trim(),
    valence,
    kind: 'manual',
    reaction: reactionFor(life, { text, time: time || '', valence }),
    at: new Date().toISOString()
  }
}

export function environmentFor(life, world, now = new Date()) {
  const hour = now.getHours()
  const light =
    hour < 6 ? '窗外还是深蓝色，屋里只亮着一盏小灯' :
    hour < 9 ? '晨光从窗帘缝里透进来，空气有点凉' :
    hour < 12 ? '阳光落在桌角，灰尘在光里飘' :
    hour < 14 ? '正午的光很硬，屋里亮得有点刺眼' :
    hour < 18 ? '午后偏暖，窗台的绿萝影子被拉长' :
    hour < 21 ? '天色暗下来，楼下开始有车流声' :
    '夜里的光只剩屏幕和台灯，很安静'

  const condition = world?.weather?.condition || '阴'
  const temp = world?.weather?.temperature_c
  const sound = /雨/.test(condition)
    ? '雨点敲在窗玻璃上，断断续续'
    : /雪/.test(condition)
      ? '外面很静，雪把声音都吸走了'
      : hour >= 22 || hour < 6
        ? '远处偶尔有车经过，其余时候很安静'
        : hour < 9
          ? '楼下有人走动，偶尔传来关门声'
          : '窗外有风声和远处的车流'

  const air = `${condition}，${temp ?? '?'}℃，${temp >= 26 ? '屋里有点闷' : temp <= 10 ? '空气凉飕飕的' : '不冷不热'}`
  const activity = getActivity(life, now)
  const details = life.profile?.residence?.environment || []
  const detail = details.length
    ? details[parseInt(hashSeed(world?.date || '', String(hour)).slice(0, 4), 16) % details.length]
    : '手边放着一杯没喝完的水'

  return [
    `此刻：${daypart(now)}，你在${activity}`,
    `光线：${light}`,
    `声音：${sound}`,
    `空气：${air}`,
    `手边：${detail}`
  ]
}

const INNER_CLOSINGS = {
  proud: '……才不是在想主人。',
  tsundere: '才、才没有想让你安慰。',
  open: '要是你在就好了。',
  gentle: '希望主人今天也顺利。',
  lazy: '……好想躺着。',
  sharp: '……别让我说第二遍。'
}

const GUIDES = {
  proud: {
    low: ['……你要是有空，就过来陪本小姐说两句。', '去把水喝了，别又熬夜。', '……夸我一句会死吗。'],
    mid: ['今天别熬太晚，早点睡。', '……过来，让我看看你。', '有事就说，别憋着。'],
    high: ['过来亲一下，今天的事就算了。', '……别走，再陪我一会儿。', '累了就靠过来。']
  },
  tsundere: {
    low: ['……有空就陪我说会儿话。就一会儿。', '谁、谁要你陪了……不过你要来也行。', '记得喝水。'],
    mid: ['今天早点睡。', '……你要是没事，就过来一下。', '别老是一个人闷着。'],
    high: ['过来抱一下。就一下。', '……别走那么快。', '今天可以多陪我一会儿吗。']
  },
  open: {
    low: ['你忙完来找我嘛。', '跟我说说今天的事。', '有空一起打游戏。'],
    mid: ['陪我聊会儿天。', '今天也跟我说晚安。', '过来，给你看个好东西。'],
    high: ['过来让我抱一下。', '今天就别走了，陪我。', '想听你多说两句。']
  },
  gentle: {
    low: ['记得喝水。', '早点休息。', '有事要告诉我。'],
    mid: ['今天累不累？先歇一会儿吧。', '别熬太晚。', '想说话的时候，我在。'],
    high: ['过来，让我抱抱你。', '今天也辛苦了，早点睡。', '有事不要一个人扛。']
  },
  lazy: {
    low: ['……过来一起躺会儿。', '别忙了，歇一下。', '帮我拿杯水。'],
    mid: ['今天别折腾了，早点睡。', '过来坐会儿。', '……陪我躺一下。'],
    high: ['过来，让我靠一会儿。', '别走，再躺五分钟。', '今天就在这儿陪我。']
  },
  sharp: {
    low: ['还不去睡觉？', '去把水喝了。', '有事说事，别磨蹭。'],
    mid: ['今天早点睡，别逼我催。', '过来，把话说完。', '别老盯着屏幕。'],
    high: ['过来，让我骂两句再走。', '……别走，陪我一会儿。', '今天可以多待一会儿。']
  }
}

function guideFor(life, feelingBad) {
  const arch = life.affection?.archetype || 'proud'
  const level = affectionLevel(life.affection?.affection)
  const pool = [...(GUIDES[arch]?.[level] || GUIDES.proud.mid)]
  if (feelingBad) pool.push('……别一个人闷着，说给我听。')
  return pool[Math.floor(Math.random() * pool.length)]
}

const ANNOYED = {
  proud: '都说了多少遍了……好烦。希望他别再没完没了了。',
  tsundere: '……好烦。别再来找我了。',
  open: '唉，今天真的有点累……想一个人待会儿。',
  gentle: '有点累了……希望他能自己先处理好。',
  lazy: '姆……好烦。别再叫我了。',
  sharp: '烦死了，这人怎么又来。希望他闭嘴。'
}

export function buildInnerThought(life, world) {
  const arch = life.affection?.archetype || 'proud'
  const level = affectionLevel(life.affection?.affection)
  const mood = world?.mood?.label || '平静'
  const events = world?.events || []
  const last = events[events.length - 1]
  const lastValence = Number(last?.valence ?? 0)
  const feelingBad = ['低落', '烦躁'].includes(mood) || lastValence < -0.2
  const feelingGood = ['开心', '兴奋'].includes(mood) || lastValence > 0.2
  const tags = new Set((life.preferences?.likes || []).flatMap((x) => x.tags || []))
  const wantsWarm = tags.has('warm') || tags.has('praise') || tags.has('亲亲')
  const journal = world?.journal || []
  const noUser = !journal.some((x) => x.kind === 'manual')

  const bits = []
  if (feelingBad) bits.push(`今天${last ? last.title : '有点不顺'}，${mood}。`)
  else if (feelingGood) bits.push(`今天${last ? last.title : '还行'}，心情还不错。`)
  else bits.push(`今天${last ? last.title : '没什么特别的'}，就这么过着。`)

  const hour = new Date().getHours()
  const late = hour >= 23 || hour < 6
  const busy = journal.length >= 3
  if ((late && busy) || (feelingBad && busy)) {
    bits.push(ANNOYED[arch] || ANNOYED.proud)
    bits.push('希望能让我安静一会儿。')
    bits.push(INNER_CLOSINGS[arch] || '')
    return bits.join('')
  }

  if (wantsWarm && feelingBad) bits.push('真不舒服啊……主人要是能亲亲我就好了。')
  else if (wantsWarm && level === 'high') bits.push('要是主人现在过来，本小姐也不是不能给他亲一下。')
  else if (noUser) bits.push('主人今天都没怎么理我。')
  else if (level === 'high') bits.push('主人现在在干嘛呢，也不过来看看我。')
  else bits.push('主人现在在干嘛呢。')

  if (level === 'low' && feelingBad) bits.push('反正主人也不会在意吧。')
  bits.push(guideFor(life, feelingBad))
  bits.push(INNER_CLOSINGS[arch] || '')
  return bits.join('')
}

export function buildOverview(life, world, archetypes) {
  const aff = Math.round(Number(life.affection?.affection ?? 0) * 100) / 100
  const tier = tierFor(aff, archetypes?.tiers || [])
  const mood = world?.mood?.label || '平静'
  const view = viewFor(life)
  const innerThought = buildInnerThought(life, world)
  return {
    name: life.profile?.name || '姆咪',
    avatar: life.profile?.avatar || '/dsh-humanizer/avatar?name=mumi.png',
    background: life.profile?.background || '/dsh-humanizer/background?name=mumi-full.png',
    archetype: life.affection?.archetype || 'proud',
    affection: aff,
    familiarity: Number(life.affection?.familiarity ?? 0),
    tier: tier?.label || '—',
    mood,
    view,
    inner: innerThought,
    innerThought,
    covers: Array.from({ length: 6 }, () => generateCover(life)),
    today: world?.date || '',
    weekday: world?.date ? weekdayCN(world.date) : '',
    eventCount: (world?.events || []).length,
    journalCount: (world?.journal || []).length,
    likes: (life.preferences?.likes || []).length,
    dislikes: (life.preferences?.dislikes || []).length
  }
}
