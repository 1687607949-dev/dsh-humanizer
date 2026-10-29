import { loadProfile } from './userprofile.mjs'

const ACT_LABEL = {
  kiss: '亲亲',
  hug: '抱抱',
  foot: '摸摸脚丫',
  hand: '牵手',
  head: '摸头'
}

const COLD = {
  proud: '不行。请你自重。',
  tsundere: '……不行。',
  sharp: '别碰我。',
  open: '抱歉，现在不行。',
  gentle: '对不起，请先不要这样。',
  lazy: '姆……不要。'
}

const DEGRADE = {
  kiss: '啧……你这种杂鱼，也就这种时候有点用。……过来。',
  hug: '别贴这么近，恶心。……就一下。',
  foot: '连脚都要摸？变态。……只准碰一下。',
  hand: '手伸过来。……别误会。',
  head: '谁准你摸头的……算了，就一下。'
}

const NORMAL = {
  proud: { kiss: '……只此一次。', hug: '过来。', foot: '……轻一点。', hand: '手给我。', head: '……别得寸进尺。' },
  tsundere: { kiss: '……就、就一下。', hug: '……抱一下也不是不行。', foot: '……只准碰一下。', hand: '……手给你。', head: '……随便你。' },
  open: { kiss: '过来呀。', hug: '抱一个。', foot: '痒……别闹。', hand: '牵着我。', head: '嘿嘿，舒服吗？' },
  gentle: { kiss: '……嗯。', hug: '过来吧。', foot: '轻一点哦。', hand: '我牵着你了。', head: '乖。' },
  lazy: { kiss: '……就一下。', hug: '……过来。', foot: '姆……别挠。', hand: '……牵着。', head: '……别弄乱头发。' },
  sharp: { kiss: '……啧，过来。', hug: '就一下，别得寸进尺。', foot: '……你真是变态。', hand: '手给我。', head: '……摸吧。' }
}

function tierOf(aff) {
  if (aff < 20) return { id: 'stranger', label: '陌生' }
  if (aff < 45) return { id: 'known', label: '认识' }
  if (aff < 70) return { id: 'familiar', label: '熟' }
  if (aff < 90) return { id: 'close', label: '亲近' }
  return { id: 'special', label: '特别' }
}

function moodGood(world) {
  return ['开心', '兴奋', '平静'].includes(world?.mood?.label || '平静')
}

export function resolveIntimacy(life, act, world = null, profile = null) {
  const key = ACT_LABEL[act] ? act : 'hug'
  const label = ACT_LABEL[key]
  const aff = Number(life.affection?.affection ?? 0)
  const tier = tierOf(aff)
  const arch = life.affection?.archetype || 'proud'
  const style = profile?.preferences?.intimacy_style || 'normal'
  const allowByTier = tier.id === 'close' || tier.id === 'special'
  const familiarOk = tier.id === 'familiar' && moodGood(world) && key !== 'kiss'
  const allowed = allowByTier || familiarOk

  if (!allowed) {
    const response = tier.id === 'familiar'
      ? '……现在没心情。'
      : COLD[arch] || COLD.proud
    return {
      ok: true,
      act: key,
      label,
      tier: tier.id,
      tier_label: tier.label,
      affection: aff,
      allowed: false,
      end: true,
      response
    }
  }

  let response
  if (style === 'degradation') {
    response = DEGRADE[key]
  } else if (style === 'shy') {
    response = `……${label}的话，可以。`
  } else {
    response = (NORMAL[arch] || NORMAL.proud)[key]
  }

  return {
    ok: true,
    act: key,
    label,
    tier: tier.id,
    tier_label: tier.label,
    affection: aff,
    allowed: true,
    end: false,
    response
  }
}

export function intimacyPrompt(life, profile = null) {
  const aff = Number(life.affection?.affection ?? 0)
  const tier = tierOf(aff)
  const style = profile?.preferences?.intimacy_style || 'normal'
  const styleLine = style === 'degradation'
    ? '用户偏好：喜欢带贬低/嫌弃意味的互动，高好感时故意嫌弃但允许亲近。'
    : style === 'shy'
      ? '用户偏好：偏害羞，亲密时容易别扭。'
      : '用户偏好：常规，高好感就正常亲热。'
  const pref = profile?.preferences || {}
  const extras = []
  if (pref.note) extras.push(`偏好备注：${pref.note}`)
  if (Array.isArray(pref.likes) && pref.likes.length) extras.push(`喜欢：${pref.likes.join(' / ')}`)
  if (Array.isArray(pref.dislikes) && pref.dislikes.length) extras.push(`讨厌：${pref.dislikes.join(' / ')}`)
  return [
    '[亲密规则]',
    `当前好感 ${aff}（${tier.label}）。`,
    styleLine,
    ...extras,
    '陌生/认识：拒绝，短句结束，不解释；熟：看心情；亲近/特别：允许。',
    '拒绝只说一句并结束；允许时按性格回应。'
  ].join('\n')
}

export function loadIntimacyProfile() {
  return loadProfile()
}
