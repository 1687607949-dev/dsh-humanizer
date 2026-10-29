const WISHES = {
  kiss: { label: '亲亲', line: '……说什么呢，怎么可能想要你的亲亲。', aliases: ['kiss', '亲亲', '亲一下'] },
  hug: { label: '抱抱', line: '过来一下。……就一下。', aliases: ['hug', '抱抱', '抱一下'] },
  head: { label: '摸头', line: '……头发都被你弄乱了。', aliases: ['head', 'headpat', '摸头'] },
  foot: { label: '摸摸脚', line: '脚有点酸……别多想。', aliases: ['foot', '摸脚', '摸摸脚', '足'] },
  water: { label: '去喝水', line: '去把水喝了，别让我说第二遍。', aliases: ['water', '喝水', '倒水'] },
  rest: { label: '去休息', line: '别熬了，去睡。', aliases: ['rest', '睡觉', '休息'] },
  praise: { label: '被夸一句', line: '今天做得还行……别得意。', aliases: ['praise', '夸奖', '夸我'] },
  company: { label: '陪一会儿', line: '……别走，陪我一会儿。', aliases: ['company', '陪', '陪我'] }
}

function hashPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function currentWish(life, now = Date.now()) {
  const w = life?.innerWish
  if (!w || w.fulfilled) return null
  if (w.expiresAt && Date.parse(w.expiresAt) < now) return null
  return w
}

export function createWish(life, world = null) {
  const existing = currentWish(life)
  if (existing) return existing
  const aff = Number(life.affection?.affection ?? 0)
  const arch = life.affection?.archetype || 'proud'
  const likes = (life.preferences?.likes || []).flatMap((x) => x.tags || [])
  const mood = world?.mood?.label || '平静'
  let kind = 'company'

  if (aff < 20) {
    kind = hashPick(['space', 'water'])
  } else if (aff < 45) {
    kind = hashPick(['water', 'rest', 'head'])
  } else if (aff < 70) {
    kind = hashPick(['hug', 'head', 'praise'])
  } else {
    if (likes.includes('足')) kind = hashPick(['foot', 'kiss', 'hug'])
    else if (mood === '开心' || mood === '兴奋') kind = hashPick(['kiss', 'hug', 'praise'])
    else kind = hashPick(['kiss', 'company', 'hug'])
  }

  if (kind === 'space') {
    const wish = {
      kind: 'space',
      label: '别来打扰',
      line: '……让我安静一会儿。',
      aliases: ['space', '安静', '别打扰'],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 6 * 3600e3).toISOString(),
      fulfilled: false
    }
    life.innerWish = wish
    return wish
  }

  const base = WISHES[kind] || WISHES.company
  const wish = {
    kind,
    label: base.label,
    line: base.line,
    aliases: base.aliases,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 3600e3).toISOString(),
    fulfilled: false
  }
  life.innerWish = wish
  return wish
}

export function fulfillWish(life, act) {
  const wish = currentWish(life)
  if (!wish) return { matched: false, reason: '没有待完成的愿望' }
  const key = String(act || '').trim().toLowerCase()
  const aliases = (wish.aliases || []).map((x) => String(x).toLowerCase())
  if (wish.kind === 'space') return { matched: false, wish, reason: '她现在只想安静' }
  if (!aliases.includes(key)) return { matched: false, wish, reason: '动作不匹配' }
  wish.fulfilled = true
  wish.fulfilledAt = new Date().toISOString()
  return { matched: true, wish }
}

export function wishForPrompt(life) {
  const wish = currentWish(life)
  if (!wish) return ''
  return [
    '[她现在的愿望]',
    `她想要：${wish.label}。`,
    '只有用户实际做出这个行为时才加好感；单纯点开内心戏不算。',
    '如果当前对话里用户已经做了，调用 humanizer_record_action 记录一次；只点开内心戏不要调用。',
    '不要因为她嘴上说不要就判定没做；用户做了就记录。'
  ].join('\n')
}
