import { OB_QUESTIONS } from './onboarding-bank.js'

const API = '/dsh-humanizer/api'
const $ = (id) => document.getElementById(id)

let state = null
let dirty = false

function h(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function api(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const data = await res.json().catch(() => ({ ok: false, error: { message: '返回不是 JSON' } }))
  if (!res.ok || data.ok === false) {
    const message = data?.error?.message || `HTTP ${res.status}`
    const err = new Error(message)
    err.details = data?.error?.details
    throw err
  }
  return data
}

function toast(message, kind = '') {
  const el = $('toast')
  el.textContent = message
  el.className = `toast show ${kind}`.trim()
  clearTimeout(toast._t)
  toast._t = setTimeout(() => { el.className = 'toast' }, 2600)
}

function setDirty(value) {
  dirty = value
  const el = $('dirty')
  el.textContent = value ? '有未保存修改' : '已保存'
  el.classList.toggle('on', value)
}

function markDirty() { setDirty(true) }

function formatTime(iso) {
  try {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return '—'
  }
}

function activateTab(name) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === name)
  for (const p of document.querySelectorAll('.tabpane')) p.classList.toggle('active', p.id === `pane-${name}`)
  if (name === 'ai' && !$('ai-persona').value) aiLoadSoul().catch(() => {})
}

async function load() {
  const prevAff = state?.affection?.affection ?? state?.overview?.affection
  const data = await api('/state')
  const nextAff = data.affection?.affection ?? data.overview?.affection
  state = data
  render()
  setDirty(false)
  const tab = new URLSearchParams(location.search).get('tab')
  if (tab) activateTab(tab)
  if (prevAff != null && nextAff != null && Math.abs(Number(nextAff) - Number(prevAff)) >= 0.01) {
    animateAffection(Number(nextAff) - Number(prevAff))
  }
  obInit()
}

function render() {
  renderLife()
  renderOverview()
  loadAvatars()
  loadBackgrounds()
  loadProfile()
  loadAuthor()
  renderEnvironment()
  renderJournal()
  renderPersona()
  renderMood()
  renderEvents()
  renderStyle()
  renderAffection()
  renderRaiseMeta()
  renderWish(null)
  renderLogs()
  loadAiLogs()
  renderStatus()
}

function renderStatus() {
  const enabled = state.life.style?.enabled !== false
  const el = $('status')
  el.textContent = enabled ? '已启用' : '已关闭'
  el.classList.toggle('off', !enabled)
}

function renderLife() {
  const p = state.life.profile || {}
  $('city-name').value = p.city?.name || ''
  $('climate-zone').value = p.city?.climate_zone || 'humid_subtropical'
  $('residence-type').value = p.residence?.type || ''
  $('residence-desc').value = p.residence?.description || ''
  $('environment').value = (p.residence?.environment || []).join('\n')

  $('schedule-body').innerHTML = (state.life.schedule || []).map((s) => `
    <tr>
      <td><input class="sc-start" type="time" value="${h(s.start)}" /></td>
      <td><input class="sc-end" type="time" value="${h(s.end)}" /></td>
      <td><input class="sc-activity" type="text" value="${h(s.activity)}" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`).join('')

  const w = state.world.weather || {}
  $('weather-now').textContent = `${w.condition || '—'} ${w.temperature_c ?? '—'}℃  ·  ${w.source === 'locked' ? '手动锁定' : '世界种子生成'}`
  $('weather-condition').value = state.life.weather?.locked?.condition || ''
  $('weather-temp').value = state.life.weather?.locked?.temperature_c ?? ''
}

function renderOverview() {
  const o = state.overview || {}
  const life = state.life || {}
  $('ov-name').textContent = o.name || life.profile?.name || '姆咪'
  const avatar = o.avatar || life.profile?.avatar || '/dsh-humanizer/avatar?name=mumi.png'
  $('ov-avatar').src = avatar
  $('avatar-preview').src = avatar
  const bg = o.background || life.profile?.background || '/dsh-humanizer/background?name=mumi-full.png'
  const art = document.querySelector('.bg-art')
  if (art) art.style.backgroundImage = `url("${bg}")`
  $('ov-sub').textContent = `${o.archetype || '—'} · ${o.tier || '—'} · ${o.weekday || ''} ${o.today || ''}`.trim()
  $('ov-mood').textContent = o.mood || '—'
  $('ov-tier').textContent = `好感档位 ${o.tier || '—'}`
  const aff = Number(o.affection ?? 0)
  const fam = Number(o.familiarity ?? 0)
  $('ov-aff').textContent = String(Math.round(aff * 10) / 10)
  $('ov-fam').textContent = String(fam)
  $('ov-aff-bar').style.width = `${Math.max(0, Math.min(100, ((aff + 100) / 200) * 100))}%`
  $('ov-fam-bar').style.width = `${Math.max(0, Math.min(100, fam))}%`
  $('ov-view').textContent = o.view || '—'
  $('ov-inner').textContent = o.innerThought || o.inner || '—'
  const covers = o.covers || ['不准看。']
  $('inner-cover').textContent = covers[Math.floor(Math.random() * covers.length)]
  $('inner-lock').classList.remove('revealed')
  $('ov-stats').textContent = `今日事件 ${o.eventCount ?? 0} · 记录 ${o.journalCount ?? 0} · 喜欢 ${o.likes ?? 0} / 讨厌 ${o.dislikes ?? 0}`
}

async function loadAvatars() {
  try {
    const data = await api('/avatars')
    const list = data.avatars || []
    const select = $('avatar-select')
    select.innerHTML = list.map((a) => `<option value="${h(a.url)}">${h(a.name)}</option>`).join('')
    const current = state.overview?.avatar || state.life?.profile?.avatar || list[0]?.url
    if (current) {
      select.value = current
      $('avatar-preview').src = current
      $('ov-avatar').src = current
    }
  } catch {}
}

async function loadProfile() {
  try {
    const data = await api('/profile')
    const p = data.profile || {}
    state.profile = p
    $('profile-style').textContent = `${data.stats.style_label || '—'} · 情感互动 ${Math.round((data.stats.ratio || 0) * 100)}% · 好感上限 ${data.stats.cap ?? '—'}`
    $('profile-summary').textContent = p.summary || '—'
    $('profile-traits').innerHTML = (p.traits || []).map((t) => `<span class="pill">${h(t)}</span>`).join('')
    $('profile-suggestions').innerHTML = (p.suggestions || []).map((s) => `<li>${h(s)}</li>`).join('')
    if ($('intimacy-style')) $('intimacy-style').value = p.preferences?.intimacy_style || 'normal'
    if ($('pref-note')) $('pref-note').value = p.preferences?.note || ''
    if ($('pref-likes')) $('pref-likes').value = (p.preferences?.likes || []).join(', ')
    if ($('pref-dislikes')) $('pref-dislikes').value = (p.preferences?.dislikes || []).join(', ')
  } catch {}
}

async function loadBackgrounds() {
  try {
    const data = await api('/backgrounds')
    const list = data.backgrounds || []
    const select = $('background-select')
    select.innerHTML = list.map((a) => `<option value="${h(a.url)}">${h(a.name)}</option>`).join('')
    const current = state.overview?.background || state.life?.profile?.background || list[0]?.url
    if (current) {
      select.value = current
      const art = document.querySelector('.bg-art')
      if (art) art.style.backgroundImage = `url("${current}")`
    }
  } catch {}
}

function renderAuthor(author) {
  const a = author || {}
  $('author-note-view').textContent = a.note || '—'
  $('author-promo-view').textContent = a.promo ? `推广：${a.promo}` : ''
  $('author-links-view').innerHTML = (a.links || []).filter((l) => l.url).map((l) => {
    return `<li><b>${h(l.label || l.name || '账号')}</b> <a href="${h(l.url)}" target="_blank" rel="noreferrer">${h(l.url)}</a></li>`
  }).join('') || '<li>暂时没有公开账号</li>'
}

async function loadAuthor() {
  try {
    const data = await api('/author')
    state.author = data.author
    renderAuthor(data.author)
  } catch {}
}

function renderEnvironment() {
  const list = state.environment || []
  $('env-now').innerHTML = list.map((line) => {
    const i = line.indexOf('：')
    if (i < 0) return `<li>${h(line)}</li>`
    return `<li><b>${h(line.slice(0, i))}</b>${h(line.slice(i + 1))}</li>`
  }).join('') || '<li>环境暂时不可用</li>'
}

function renderJournal() {
  const entries = state.world?.journal || state.journal || []
  $('journal-count').textContent = entries.length ? `${entries.length} 条` : '还没有记录'
  $('journal-list').innerHTML = entries.map((e) => `
    <li>
      <div class="j-head">
        <time>${h(e.time || '')}</time>
        <span class="j-text">${h(e.text || '')}</span>
        <span class="j-tag">${h(e.kind === 'manual' ? '手记' : '事件')}</span>
      </div>
      <div class="j-reaction">${h(e.reaction || '')}</div>
    </li>`).join('') || '<li>今天还没记什么。写一笔，让她吐槽或者关心你。</li>'
}

function renderPersona() {
  $('persona-name').value = state.life.profile?.name || ''
  $('persona-identity').value = (state.life.profile?.identity || []).join('\n')

  for (const key of ['extraversion', 'neuroticism', 'openness', 'agreeableness', 'conscientiousness']) {
    const el = $(`p-${key}`)
    const v = Number(state.life.personality?.[key] ?? 0.5)
    el.value = String(v)
    const out = el.parentElement.querySelector('output')
    if (out) out.textContent = v.toFixed(2)
  }

  $('likes-body').innerHTML = (state.life.preferences?.likes || []).map((x) => `
    <tr>
      <td><input class="lk-tag" type="text" value="${h((x.tags || []).join(','))}" /></td>
      <td><input class="lk-strength" type="number" min="0" max="1" step="0.05" value="${h(x.strength)}" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`).join('')

  $('dislikes-body').innerHTML = (state.life.preferences?.dislikes || []).map((x) => `
    <tr>
      <td><input class="dl-tag" type="text" value="${h((x.tags || []).join(','))}" /></td>
      <td><input class="dl-strength" type="number" min="0" max="1" step="0.05" value="${h(x.strength)}" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`).join('')

  $('events-body').innerHTML = (state.life.events || []).map((e) => `
    <tr>
      <td><input class="ev-id" type="text" value="${h(e.id)}" /></td>
      <td><input class="ev-title" type="text" value="${h(e.title)}" /></td>
      <td><input class="ev-tags" type="text" value="${h((e.tags || []).join(','))}" /></td>
      <td><input class="ev-valence" type="number" min="-1" max="1" step="0.05" value="${h(e.valence)}" /></td>
      <td><input class="ev-intensity" type="number" min="0" max="1" step="0.05" value="${h(e.intensity)}" /></td>
      <td><input class="ev-weight" type="number" min="0.1" step="0.5" value="${h(e.weight)}" /></td>
      <td>
        <select class="ev-rarity">
          <option value="common"${e.rarity === 'common' ? ' selected' : ''}>common</option>
          <option value="uncommon"${e.rarity === 'uncommon' ? ' selected' : ''}>uncommon</option>
          <option value="rare"${e.rarity === 'rare' ? ' selected' : ''}>rare</option>
          <option value="special"${e.rarity === 'special' ? ' selected' : ''}>special</option>
        </select>
      </td>
      <td><input class="ev-window" type="text" value="${h((e.time_window || []).join('-'))}" placeholder="08:00-22:00" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`).join('')
}

function renderMood() {
  const mood = state.world.mood || {}
  const pad = mood.pad || [0, 0, 0]
  $('pad-p').textContent = Number(pad[0]).toFixed(2)
  $('pad-a').textContent = Number(pad[1]).toFixed(2)
  $('pad-d').textContent = Number(pad[2]).toFixed(2)
  $('bar-p').style.width = `${Math.round(((Number(pad[0]) + 1) / 2) * 100)}%`
  $('bar-a').style.width = `${Math.round(((Number(pad[1]) + 1) / 2) * 100)}%`
  $('bar-d').style.width = `${Math.round(((Number(pad[2]) + 1) / 2) * 100)}%`
  $('mood-label').textContent = mood.label || '—'
  $('mood-meta').textContent = `更新：${formatTime(mood.updated_at)} · 基线 P=${(mood.base?.[0] ?? 0).toFixed?.(2) ?? mood.base?.[0] ?? 0}`
  $('mood-events').innerHTML = (state.world.events || []).map((e) => `
    <li><time>${h(e.time)}</time><span>${h(e.title)}</span></li>`).join('') || '<li>今天暂时没有事件</li>'
}

function renderEvents() {
  $('world-meta').textContent = `${state.world.date} · 世界 seed ${state.world.world_seed} · epoch ${state.world.epoch} · ${state.world.weather?.condition || '—'} ${state.world.weather?.temperature_c ?? '—'}℃`
  $('today-events').innerHTML = (state.world.events || []).map((e) => {
    const locked = (state.world.locked_event_ids || []).includes(e.id)
    return `<li>
      <time>${h(e.time)}</time>
      <span class="grow">${h(e.title)} <span class="tag">${h((e.tags || []).join(' / '))}</span></span>
      <label class="tag"><input class="ev-lock" data-id="${h(e.id)}" type="checkbox"${locked ? ' checked' : ''}/> 固定</label>
    </li>`
  }).join('') || '<li>今天没有事件</li>'
}

function renderStyle() {
  const s = state.life.style || {}
  $('style-enabled').checked = s.enabled !== false
  $('style-sentences').value = s.casual_max_sentences ?? 2
  $('style-work-open').value = String(s.work_opening_sentence !== false)
  $('style-profanity').value = String(s.profanity ?? 0.1)
  $('style-initiative').value = String(s.initiative ?? 0.6)
  $('style-env').value = String(s.environment_mentions ?? 0.3)
  updateOutputs()
}

function renderAffection() {
  const archs = state.archetypes?.archetypes || {}
  $('archetype').innerHTML = Object.entries(archs).map(([id, a]) => `<option value="${h(id)}">${h(a.name)} — ${h(a.note || '')}</option>`).join('')
  $('archetype').value = state.life.affection?.archetype || 'proud'
  $('affection').value = String(state.life.affection?.affection ?? 0)
  $('familiarity').value = String(state.life.affection?.familiarity ?? 0)
  updateOutputs()
  updatePreview()
}

function renderRaiseMeta() {
  const a = state.affection || {}
  const styleLabel = { tool_only: '工具型', mixed: '混合型', emotional: '情感型', insufficient: '样本不足' }[a.style] || '—'
  const today = a.today_gain != null ? ` · 今日 +${a.today_gain}/${a.daily_cap}` : ''
  const text = `好感 ${a.affection ?? '—'} / 100 · 了解 ${a.familiarity ?? '—'} · 上限 ${a.cap ?? '—'}${today} · ${styleLabel}`
  if ($('raise-affection-meta')) $('raise-affection-meta').textContent = text
  if ($('settings-affection-status')) {
    $('settings-affection-status').textContent = `${text} · 情感互动占比 ${Math.round((a.ratio || 0) * 100)}%`
  }
}

function animateAffection(diff) {
  const fx = $('aff-fx')
  const bar = $('ov-aff-bar')
  const num = $('ov-aff')
  if (!fx || !bar || !num) return
  const up = diff > 0
  bar.classList.remove('up', 'down')
  num.classList.remove('pulse-up', 'pulse-down')
  void bar.offsetWidth
  bar.classList.add(up ? 'up' : 'down')
  num.classList.add(up ? 'pulse-up' : 'pulse-down')
  const count = up ? 8 : 6
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.className = up ? 'fx-heart' : 'fx-loss'
    el.textContent = up ? '♥' : '−'
    el.style.left = `${16 + Math.random() * 66}%`
    el.style.animationDelay = `${Math.random() * 0.28}s`
    el.style.fontSize = `${up ? 15 + Math.random() * 8 : 12 + Math.random() * 5}px`
    fx.appendChild(el)
    setTimeout(() => el.remove(), 1500)
  }
  setTimeout(() => {
    bar.classList.remove('up', 'down')
    num.classList.remove('pulse-up', 'pulse-down')
  }, 700)
}

function renderWish(wish) {
  const box = $('inner-wish')
  if (!box) return
  if (!wish) {
    box.classList.add('hidden')
    $('wish-actions').innerHTML = ''
    return
  }
  box.classList.remove('hidden')
  $('wish-line').textContent = `${wish.line || ''}（她想要：${wish.label}）`
  if (wish.kind === 'space') {
    $('wish-actions').innerHTML = '<span class="hint">这会儿别打扰她，过一阵再来。</span>'
    return
  }
  $('wish-actions').innerHTML = '<span class="hint">在对话里实际做到才算；点开内心戏、点按钮都不算。</span>'
}

function updatePreview() {
  const archs = state.archetypes?.archetypes || {}
  const a = archs[$('archetype').value]
  const aff = Number($('affection').value)
  const tiers = state.archetypes?.tiers || []
  const tier = tiers.find((t) => aff >= t.min && aff < t.max) || tiers[tiers.length - 1] || { label: '—', id: 'known' }
  const meta = state.affection || {}
  const styleLabel = { tool_only: '工具型', mixed: '混合型', emotional: '情感型', insufficient: '样本不足' }[meta.style] || '—'
  $('affection-tier').textContent = `好感档位 ${tier.label} · 上限 ${meta.cap ?? '—'} · ${styleLabel} · 情感互动 ${Math.round((meta.ratio || 0) * 100)}%`
  $('expression-line').textContent = a?.lines?.[tier.id] || '—'
  $('refusal-line').textContent = a?.refusal?.[aff >= 70 ? 'high' : 'low'] || '—'
}

function updateOutputs() {
  for (const el of document.querySelectorAll('input[type="range"]')) {
    const out = el.parentElement.querySelector('output')
    if (!out) continue
    const step = Number(el.step || 1)
    out.textContent = step >= 1 ? String(Math.round(Number(el.value))) : Number(el.value).toFixed(2)
  }
}

function renderLogs() {
  $('prompt-preview').textContent = state.prompt || '—'
  loadLogs()
}

async function loadLogs() {
  try {
    const data = await api('/logs?limit=30')
    $('logs').innerHTML = (data.logs || []).map((l) => {
      const time = formatTime(l.at)
      const label = l.event || l.error || '—'
      return `<li><b>${h(time)} ${h(label)}</b> ${h(JSON.stringify({ ...l, at: undefined, event: undefined }))}</li>`
    }).join('') || '<li>暂无日志</li>'
  } catch (e) {
    $('logs').innerHTML = `<li>日志加载失败：${h(e.message)}</li>`
  }
}

async function loadAiLogs() {
  try {
    const data = await api('/logs?limit=100')
    const logs = (data.logs || []).filter((l) => String(l.event || '').startsWith('ai_'))
    $('ai-logs').innerHTML = logs.map((l) => {
      const detail = (l.notes || []).join('；') || JSON.stringify(l.patch || {}).slice(0, 220)
      return `<li><b>${h(formatTime(l.at))} ${h(l.event)}</b> ${h(detail)}</li>`
    }).join('') || '<li>还没有 AI 修改记录</li>'
  } catch {}
}

async function aiPreview() {
  const text = $('ai-persona').value.trim()
  if (!text) return toast('先粘贴一段人设', 'error')
  try {
    const data = await api('/ai/preview', { method: 'POST', body: JSON.stringify({ text }) })
    $('ai-diff').textContent = JSON.stringify({ notes: data.notes, patch: data.patch, errors: data.errors }, null, 2)
    toast(data.ok ? '推导完成，点应用生效' : '推导完成，但有校验错误', data.ok ? 'ok' : 'error')
  } catch (e) {
    toast(`推导失败：${e.message}`, 'error')
  }
}

async function aiApply() {
  const text = $('ai-persona').value.trim()
  if (!text) return toast('先粘贴一段人设', 'error')
  try {
    const data = await api('/ai/apply', { method: 'POST', body: JSON.stringify({ text }) })
    state.life = data.life
    state.world = data.world
    state.prompt = data.prompt
    render()
    toast('已按人设应用设置', 'ok')
  } catch (e) {
    const detail = e.details?.length ? `：${e.details.map((d) => `${d.path} ${d.reason}`).join('；')}` : ''
    toast(`应用失败：${e.message}${detail}`, 'error')
  }
}

async function aiLoadSoul() {
  try {
    const data = await api('/ai/source')
    $('ai-persona').value = data.text
    toast(`已读取 ${data.file}`, 'ok')
    await aiPreview()
  } catch (e) {
    toast(`读取失败：${e.message}`, 'error')
  }
}

function collectLife() {
  const life = structuredClone(state.life)
  life.profile = life.profile || {}
  life.profile.name = $('persona-name').value.trim()
  life.profile.identity = $('persona-identity').value.split('\n').map((x) => x.trim()).filter(Boolean)
  life.profile.city = life.profile.city || {}
  life.profile.city.name = $('city-name').value.trim()
  life.profile.city.climate_zone = $('climate-zone').value
  life.profile.residence = life.profile.residence || {}
  life.profile.residence.type = $('residence-type').value.trim()
  life.profile.residence.description = $('residence-desc').value.trim()
  life.profile.residence.environment = $('environment').value.split('\n').map((x) => x.trim()).filter(Boolean)

  life.schedule = [...$('schedule-body').querySelectorAll('tr')].map((tr) => ({
    start: tr.querySelector('.sc-start').value,
    end: tr.querySelector('.sc-end').value,
    activity: tr.querySelector('.sc-activity').value.trim()
  })).filter((s) => s.start && s.end && s.activity)

  for (const key of ['extraversion', 'neuroticism', 'openness', 'agreeableness', 'conscientiousness']) {
    life.personality = life.personality || {}
    life.personality[key] = Number($(`p-${key}`).value)
  }

  life.preferences = life.preferences || {}
  life.preferences.likes = [...$('likes-body').querySelectorAll('tr')].map((tr, i) => {
    const tags = tr.querySelector('.lk-tag').value.split(',').map((x) => x.trim()).filter(Boolean)
    return { id: `like_${i}`, tags, strength: Number(tr.querySelector('.lk-strength').value) }
  }).filter((x) => x.tags.length)
  life.preferences.dislikes = [...$('dislikes-body').querySelectorAll('tr')].map((tr, i) => {
    const tags = tr.querySelector('.dl-tag').value.split(',').map((x) => x.trim()).filter(Boolean)
    return { id: `dislike_${i}`, tags, strength: Number(tr.querySelector('.dl-strength').value) }
  }).filter((x) => x.tags.length)

  life.events = [...$('events-body').querySelectorAll('tr')].map((tr) => {
    const window = tr.querySelector('.ev-window').value.trim()
    const [a, b] = window.includes('-') ? window.split('-') : []
    return {
      id: tr.querySelector('.ev-id').value.trim(),
      title: tr.querySelector('.ev-title').value.trim(),
      tags: tr.querySelector('.ev-tags').value.split(',').map((x) => x.trim()).filter(Boolean),
      valence: Number(tr.querySelector('.ev-valence').value),
      intensity: Number(tr.querySelector('.ev-intensity').value),
      weight: Number(tr.querySelector('.ev-weight').value),
      rarity: tr.querySelector('.ev-rarity').value,
      ...(a && b ? { time_window: [a.trim(), b.trim()] } : {})
    }
  }).filter((e) => e.id && e.title)

  const ids = life.events.map((e) => e.id)
  if (new Set(ids).size !== ids.length) throw new Error('事件 ID 有重复')

  life.style = {
    ...(life.style || {}),
    enabled: $('style-enabled').checked,
    casual_max_sentences: Number($('style-sentences').value),
    work_opening_sentence: $('style-work-open').value === 'true',
    profanity: Number($('style-profanity').value),
    initiative: Number($('style-initiative').value),
    environment_mentions: Number($('style-env').value)
  }

  life.affection = {
    ...(life.affection || {}),
    archetype: $('archetype').value,
    affection: Number($('affection').value),
    familiarity: Number($('familiarity').value)
  }

  return life
}

async function save() {
  try {
    const life = collectLife()
    const data = await api('/life', { method: 'PUT', body: JSON.stringify(life) })
    toast('已保存，下一轮生效', 'ok')
    state.life = life
    setDirty(false)
    await load()
  } catch (e) {
    const detail = e.details?.length ? `：${e.details.map((d) => `${d.path} ${d.reason}`).join('；')}` : ''
    toast(`保存失败：${e.message}${detail}`, 'error')
  }
}

function addRow(tbodyId, html) {
  const tbody = $(tbodyId)
  tbody.insertAdjacentHTML('beforeend', html)
  markDirty()
}

document.addEventListener('input', (e) => {
  if (e.target.closest('.app')) markDirty()
  if (e.target.matches('input[type="range"]')) updateOutputs()
  if (['archetype', 'affection', 'familiarity'].includes(e.target.id)) updatePreview()
})
document.addEventListener('change', (e) => {
  if (e.target.closest('.app')) markDirty()
  if (e.target.id === 'avatar-select') {
    (async () => {
      try {
        const data = await api('/avatar', { method: 'POST', body: JSON.stringify({ url: e.target.value }) })
        state.life = data.life
        state.overview.avatar = data.url
        renderOverview()
        toast('形象已切换', 'ok')
      } catch (err) {
        toast(`切换失败：${err.message}`, 'error')
      }
    })()
  }
  if (e.target.id === 'avatar-file') {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = await api('/avatar', { method: 'POST', body: JSON.stringify({ data_url: reader.result }) })
        state.life = data.life
        state.overview.avatar = data.url
        renderOverview()
        await loadAvatars()
        toast('形象已更新', 'ok')
      } catch (err) {
        toast(`上传失败：${err.message}`, 'error')
      }
    }
    reader.readAsDataURL(file)
  }
  if (e.target.id === 'background-select') {
    (async () => {
      try {
        const data = await api('/background', { method: 'POST', body: JSON.stringify({ url: e.target.value }) })
        state.life = data.life
        state.overview.background = data.url
        const art = document.querySelector('.bg-art')
        if (art) art.style.backgroundImage = `url("${data.url}")`
        toast('背景已切换', 'ok')
      } catch (err) {
        toast(`切换失败：${err.message}`, 'error')
      }
    })()
  }
  if (e.target.id === 'background-file') {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const data = await api('/background', { method: 'POST', body: JSON.stringify({ data_url: reader.result }) })
        state.life = data.life
        state.overview.background = data.url
        const art = document.querySelector('.bg-art')
        if (art) art.style.backgroundImage = `url("${data.url}")`
        await loadBackgrounds()
        toast('背景已更新', 'ok')
      } catch (err) {
        toast(`上传失败：${err.message}`, 'error')
      }
    }
    reader.readAsDataURL(file)
  }
  if (e.target.matches('.ev-lock')) {
    const eventId = e.target.dataset.id
    api('/world/lock-event', {
      method: 'POST',
      body: JSON.stringify({ date: state.world.date, event_id: eventId, locked: e.target.checked })
    }).then(async () => {
      toast(e.target.checked ? '已固定事件' : '已解除固定', 'ok')
      await load()
    }).catch((err) => toast(`操作失败：${err.message}`, 'error'))
  }
  if (e.target.id === 'weather-condition') {
    // 交给“锁定天气”按钮，不自动保存
  }
})

document.addEventListener('click', async (e) => {
  const del = e.target.closest('.del-row')
  if (del) {
    del.closest('tr').remove()
    markDirty()
    return
  }

  const wishBtn = e.target.closest('[data-wish-act]')
  if (wishBtn) {
    try {
      const data = await api('/wish/fulfill', { method: 'POST', body: JSON.stringify({ act: wishBtn.dataset.wishAct }) })
      if (data.matched) {
        toast(`愿望完成，好感 +${Number(data.delta || 0).toFixed(2)}`, 'ok')
        await load()
      } else {
        toast(data.reason || '这个动作不对', '')
      }
    } catch (err) {
      toast(`记录失败：${err.message}`, 'error')
    }
    return
  }

  const lock = e.target.closest('#inner-lock')
  if (lock) {
    if (!lock.classList.contains('revealed')) {
      lock.classList.add('revealed')
      api('/inner-peek', { method: 'POST' }).then((data) => {
        $('ov-inner').textContent = data.inner || '—'
        renderWish(data.wish)
        if (data.wish) toast(`她想要：${data.wish.label}`, '')
      }).catch(() => {})
      return
    }
    lock.classList.remove('revealed')
    renderWish(null)
    const covers = state.overview?.covers || ['不准看。']
    $('inner-cover').textContent = covers[Math.floor(Math.random() * covers.length)]
    return
  }

  const tab = e.target.closest('.tab')
  if (tab) {
    activateTab(tab.dataset.tab)
    return
  }

  if (e.target.id === 'save') return save()
  if (e.target.id === 'close') {
    if (window.parent !== window) window.parent.postMessage({ type: 'dsh-humanizer-close' }, '*')
    return
  }
  if (e.target.id === 'ai-preview') return aiPreview()
  if (e.target.id === 'ai-apply') return aiApply()
  if (e.target.id === 'ai-load-soul') return aiLoadSoul()
  if (e.target.id === 'journal-add') {
    const text = $('journal-input').value.trim()
    if (!text) return toast('写点什么再记', 'error')
    try {
      const data = await api('/journal', {
        method: 'POST',
        body: JSON.stringify({ text, date: state.world.date })
      })
      state.world = data.world
      state.overview = data.overview
      state.journal = data.journal
      try {
        const aff = await api('/interaction', { method: 'POST', body: JSON.stringify({ kind: 'journal' }) })
        state.affection = aff.affection
        state.life.affection.affection = aff.result.after
        state.overview.affection = aff.result.after
      } catch {}
      $('journal-input').value = ''
      renderOverview()
      renderJournal()
      renderAffection()
      toast('记下了', 'ok')
    } catch (err) {
      toast(`记录失败：${err.message}`, 'error')
    }
    return
  }
  if (e.target.id === 'intimacy-pref-save') {
    try {
      const split = (v) => v.split(/[,，]/).map((x) => x.trim()).filter(Boolean)
      const data = await api('/profile/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          intimacy_style: $('intimacy-style').value,
          note: $('pref-note').value.trim(),
          likes: split($('pref-likes').value),
          dislikes: split($('pref-dislikes').value)
        })
      })
      state.profile = data.profile
      toast('亲密偏好已保存', 'ok')
    } catch (err) {
      toast(`保存失败：${err.message}`, 'error')
    }
    return
  }
  if (e.target.id === 'onboarding-restart') {
    try {
      await api('/onboarding', { method: 'POST', body: JSON.stringify({ reset: true }) })
      state.onboarding = { completed: false }
      obInit()
      toast('重新开始引导', 'ok')
    } catch (err) {
      toast(`重置失败：${err.message}`, 'error')
    }
    return
  }
  if (e.target.id === 'profile-refresh') {
    try {
      await api('/profile/draft', { method: 'POST' })
      await loadProfile()
      toast('画像草稿已刷新', 'ok')
    } catch (err) {
      toast(`刷新失败：${err.message}`, 'error')
    }
    return
  }
  if (e.target.id === 'add-schedule') {
    return addRow('schedule-body', `<tr>
      <td><input class="sc-start" type="time" value="09:00" /></td>
      <td><input class="sc-end" type="time" value="10:00" /></td>
      <td><input class="sc-activity" type="text" value="新的活动" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`)
  }
  if (e.target.id === 'add-like') {
    return addRow('likes-body', `<tr>
      <td><input class="lk-tag" type="text" value="new_tag" /></td>
      <td><input class="lk-strength" type="number" min="0" max="1" step="0.05" value="0.5" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`)
  }
  if (e.target.id === 'add-dislike') {
    return addRow('dislikes-body', `<tr>
      <td><input class="dl-tag" type="text" value="new_tag" /></td>
      <td><input class="dl-strength" type="number" min="0" max="1" step="0.05" value="0.5" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`)
  }
  if (e.target.id === 'add-event') {
    return addRow('events-body', `<tr>
      <td><input class="ev-id" type="text" value="new_event" /></td>
      <td><input class="ev-title" type="text" value="新事件" /></td>
      <td><input class="ev-tags" type="text" value="misc" /></td>
      <td><input class="ev-valence" type="number" min="-1" max="1" step="0.05" value="0.3" /></td>
      <td><input class="ev-intensity" type="number" min="0" max="1" step="0.05" value="0.4" /></td>
      <td><input class="ev-weight" type="number" min="0.1" step="0.5" value="3" /></td>
      <td><select class="ev-rarity"><option value="common">common</option><option value="uncommon">uncommon</option><option value="rare">rare</option></select></td>
      <td><input class="ev-window" type="text" value="08:00-22:00" /></td>
      <td><button class="btn small icon del-row" type="button">删</button></td>
    </tr>`)
  }
  if (e.target.id === 'weather-lock') {
    const condition = $('weather-condition').value
    if (!condition) return toast('先选一个天气', 'error')
    const temperature_c = Number($('weather-temp').value) || 20
    try {
      await api('/world/weather-lock', { method: 'POST', body: JSON.stringify({ date: state.world.date, weather: { condition, temperature_c } }) })
      toast('天气已锁定', 'ok')
      await load()
    } catch (err) { toast(`失败：${err.message}`, 'error') }
    return
  }
  if (e.target.id === 'weather-unlock') {
    try {
      await api('/world/weather-lock', { method: 'POST', body: JSON.stringify({ date: state.world.date, weather: null }) })
      toast('已解除天气锁定', 'ok')
      await load()
    } catch (err) { toast(`失败：${err.message}`, 'error') }
    return
  }
  if (e.target.id === 'reroll') {
    try {
      const data = await api('/world/reroll', { method: 'POST', body: JSON.stringify({ date: state.world.date }) })
      state.world = data.world
      renderEvents()
      renderMood()
      renderLife()
      toast('今天已重开', 'ok')
    } catch (err) { toast(`失败：${err.message}`, 'error') }
    return
  }
  if (e.target.id === 'refresh-world') {
    await load()
    return
  }
  if (e.target.id === 'mood-reset') {
    try {
      const data = await api('/mood/reset', { method: 'POST', body: JSON.stringify({ date: state.world.date }) })
      state.world = data.world
      renderMood()
      toast('心情已重置', 'ok')
    } catch (err) { toast(`失败：${err.message}`, 'error') }
    return
  }
  if (e.target.id === 'refresh-prompt') {
    const data = await api('/prompt')
    $('prompt-preview').textContent = data.prompt
    return
  }
  if (e.target.id === 'refresh-logs') {
    await loadLogs()
  }
})

const OB_TOTAL = OB_QUESTIONS.length
let obStep = 0
let obAdult = false
let obAnswers = {}
let obCustomOpen = {}
let obGroup = {}
let obSearch = ''
let obSpeakTimer = null
let obFinished = false

function obSteps() {
  return ['adult', ...OB_QUESTIONS.map((q) => q.id), 'supplement', 'preview']
}

function obAns(qid) {
  if (!obAnswers[qid]) {
    obAnswers[qid] = { selected: [], labels: [], custom: '', status: 'unanswered', by_context: {}, labels_by_context: {} }
  }
  return obAnswers[qid]
}

function obSpeak(text) {
  const el = $('ob-speech')
  if (!el) return
  clearInterval(obSpeakTimer)
  el.textContent = ''
  let i = 0
  obSpeakTimer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(obSpeakTimer)
      obSpeakTimer = null
      return
    }
    el.textContent += text.charAt(i++)
    if (i % 2 === 0) obBounce()
  }, 34)
}

function obBounce() {
  const img = $('ob-avatar')
  if (!img || !img.animate) return
  try {
    img.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(-7px) scale(1.035)' },
      { transform: 'translateY(0) scale(1)' }
    ], { duration: 200, easing: 'ease-out' })
  } catch {}
}

function obStepLabel() {
  const id = obSteps()[obStep]
  if (id === 'adult') return '开始'
  if (id === 'supplement') return '补充'
  if (id === 'preview') return '预览'
  const idx = OB_QUESTIONS.findIndex((q) => q.id === id)
  return `Q${idx + 1} / ${OB_TOTAL}`
}

function obRenderAdult() {
  $('ob-step').textContent = '开始'
  obSpeak('姆，第一次见。先问一句：这次要不要开成人向的虚构互动？不开也能用，本小姐不会追问。')
  $('ob-options').innerHTML = `<div class="ob-grid">
    <button type="button" class="ob-opt${!obAdult ? ' on' : ''}" data-adult="daily">只设置日常 / 工作</button>
    <button type="button" class="ob-opt${obAdult ? ' on' : ''}" data-adult="adult">我已成年，继续设置虚构互动</button>
  </div>
  <p class="ob-note">本插件只做偏好和边界框架；DeepSeek 等模型本身不会输出露骨 NSFW，实际内容受模型能力与平台策略限制。插件不会绕过模型限制。</p>`
  $('ob-next').textContent = '下一步'
}

function obRenderQuestion(q, speak = true) {
  const idx = OB_QUESTIONS.findIndex((x) => x.id === q.id)
  $('ob-step').textContent = `Q${idx + 1} / ${OB_TOTAL}`
  if (speak) obSpeak(`姆，${q.title} ${q.hint}`)
  const ans = obAns(q.id)
  const gi = Math.max(0, Math.min((q.groups.length - 1), Number(obGroup[q.id] || 0)))
  const group = q.groups[gi]
  const flat = q.groups.flatMap((g) => g.options.map((o) => ({ ...o, group: g.label, key: g.key })))
  const source = obSearch ? flat.filter((o) => o.label.includes(obSearch) || o.id.includes(obSearch)) : group.options
  const selectedIds = q.type === 'context' ? [ans.by_context[group.key]].filter(Boolean) : (ans.selected || [])
  const max = q.max || 99
  const count = q.type === 'context' ? Object.values(ans.by_context || {}).filter(Boolean).length : selectedIds.length

  const tabs = obSearch ? '' : `<div class="ob-groups">${q.groups.map((g, i) => `<button type="button" class="ob-group-tab${i === gi ? ' on' : ''}" data-group="${i}">${h(g.label)}</button>`).join('')}</div>`
  const opts = source.map((o) => {
    const on = selectedIds.includes(o.id)
    const g = obSearch ? `<small>${h(o.group)}</small>` : ''
    return `<button type="button" class="ob-opt${on ? ' on' : ''}" data-option="${h(o.id)}" data-label="${h(o.label)}">${h(o.label)}${g}</button>`
  }).join('')
  const otherOpen = !!obCustomOpen[q.id]
  const other = `<button type="button" class="ob-other" data-other="1">${otherOpen ? '收起其他' : '+ 其他（自己写）'}</button>`
  const custom = otherOpen
    ? `<div class="ob-custom"><textarea id="ob-custom" maxlength="80" placeholder="${h(q.other_hint || '列表里没有的，写几个字。')}">${h(ans.custom || '')}</textarea><span class="ob-count">${(ans.custom || '').length} / 80</span></div>`
    : ''
  $('ob-options').innerHTML = `
    <div class="ob-tools"><input id="ob-search" class="ob-search" placeholder="搜索 ${flat.length} 个选项……" value="${h(obSearch)}" /><span class="ob-count">已选 ${count} / ${q.type === 'context' ? '每组 1' : max}</span></div>
    ${tabs}
    <div class="ob-grid">${opts}</div>
    <div class="ob-other-row">${other}${custom}</div>`
  $('ob-next').textContent = '下一步'
}

function obRenderSupplement() {
  $('ob-step').textContent = '补充'
  obSpeak('还没找到合适的？简单写一句就好。不需要重写人设，本小姐会先整理成候选标签。')
  const text = obAnswers.Q18?.text || ''
  $('ob-options').innerHTML = `<div class="ob-custom wide"><textarea id="ob-supplement" maxlength="200" placeholder="还有什么没覆盖到的偏好？可以留空。">${h(text)}</textarea><span class="ob-count">${text.length} / 200</span></div>`
  $('ob-next').textContent = '下一步'
}

function obRenderPreview() {
  $('ob-step').textContent = '预览'
  clearInterval(obSpeakTimer)
  $('ob-speech').textContent = '确认一下。左边是你真正选过的偏好；没确认的内容，一条都不会写进去。'
  const lines = []
  for (const q of OB_QUESTIONS) {
    const ans = obAns(q.id)
    if (q.type === 'context') {
      const parts = Object.entries(ans.by_context || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)
      if (parts.length) lines.push(`<li><b>Q${OB_QUESTIONS.indexOf(q) + 1}</b> ${parts.join('；')}</li>`)
    } else if (ans.labels?.length) {
      lines.push(`<li><b>Q${OB_QUESTIONS.indexOf(q) + 1}</b> ${ans.labels.join(' / ')}</li>`)
    }
    if (ans.custom) lines.push(`<li class="ob-custom-line"><b>Q${OB_QUESTIONS.indexOf(q) + 1} 其他</b> ${h(ans.custom)}</li>`)
  }
  if (obAnswers.Q18?.text) lines.push(`<li><b>补充</b> ${h(obAnswers.Q18.text)}</li>`)
  $('ob-options').innerHTML = `<ul class="ob-preview">${lines.join('') || '<li>全部跳过，将保持姆咪原版默认。</li>'}</ul>
    <p class="ob-note">保存后写入本地画像，并提示重启 DSH。成人向高级偏好不在 P0 里。</p>`
  $('ob-next').textContent = '保存'
}

function obRender(speak = true) {
  const id = obSteps()[obStep]
  if (id === 'adult') return obRenderAdult()
  if (id === 'supplement') return obRenderSupplement()
  if (id === 'preview') return obRenderPreview()
  const q = OB_QUESTIONS.find((x) => x.id === id)
  if (q) obRenderQuestion(q, speak)
}

function obSetStatus(qid) {
  const ans = obAns(qid)
  const has = (ans.selected && ans.selected.length) || (ans.by_context && Object.values(ans.by_context).some(Boolean)) || ans.custom
  ans.status = has ? 'answered' : 'skipped'
}

function obToggleOption(q, option, groupKey) {
  const ans = obAns(q.id)
  if (q.type === 'context') {
    if (!groupKey) return
    const current = ans.by_context[groupKey]
    ans.by_context[groupKey] = current === option.id ? '' : option.id
    ans.labels_by_context = ans.labels_by_context || {}
    ans.labels_by_context[groupKey] = current === option.id ? '' : option.label
    return
  }
  const selected = Array.isArray(ans.selected) ? ans.selected : []
  const labels = Array.isArray(ans.labels) ? ans.labels : []
  const pos = selected.indexOf(option.id)
  if (pos >= 0) {
    selected.splice(pos, 1)
    labels.splice(pos, 1)
  } else {
    const max = q.max || 99
    if (selected.length >= max) {
      toast(`最多选 ${max} 个`, 'error')
      return
    }
    selected.push(option.id)
    labels.push(option.label)
  }
  ans.selected = selected
  ans.labels = labels
}

function obFindOption(qid, id) {
  const q = OB_QUESTIONS.find((x) => x.id === qid)
  if (!q) return null
  for (const g of q.groups) {
    const opt = g.options.find((o) => o.id === id)
    if (opt) return { opt, group: g }
  }
  return null
}

async function obSave() {
  const answers = { adult_enabled: obAdult }
  for (const q of OB_QUESTIONS) {
    const a = obAns(q.id)
    obSetStatus(q.id)
    if (q.type === 'context') {
      answers[q.id] = { by_context: a.by_context || {}, labels_by_context: a.labels_by_context || {}, custom: a.custom || '', status: a.status }
    } else {
      answers[q.id] = { selected: a.selected || [], labels: a.labels || [], custom: a.custom || '', status: a.status }
    }
  }
  answers.Q18 = { text: obAnswers.Q18?.text || '', status: obAnswers.Q18?.text ? 'answered' : 'skipped' }

  try {
    const data = await api('/onboarding', { method: 'POST', body: JSON.stringify({ answers }) })
    if (data.ok) {
      state.onboarding = data.status || { completed: true }
      obFinished = true
      clearInterval(obSpeakTimer)
      $('ob-speech').textContent = '哼，设置好了。本小姐已经把确认过的偏好写进本地画像。需要重启 DSH 才生效；重启后再来确认。'
      $('ob-options').innerHTML = ''
      $('ob-next').textContent = '知道了'
      $('ob-skip').style.display = 'none'
      toast('设置已保存，重启 DSH 后生效', 'ok')
    }
  } catch (err) {
    toast(`保存失败：${err.message}`, 'error')
  }
}

function obNext() {
  if (obFinished) {
    $('onboarding').classList.remove('open')
    obFinished = false
    return
  }
  const id = obSteps()[obStep]
  if (id !== 'preview') obSearch = ''
  if (id === 'adult') {
    obStep++
    obRender()
    return
  }
  if (id === 'preview') {
    obSave()
    return
  }
  if (id === 'supplement') {
    const text = $('ob-supplement')?.value || ''
    obAnswers.Q18 = { text: text.trim(), status: text.trim() ? 'answered' : 'skipped' }
    obStep++
    obRender()
    return
  }
  obSetStatus(id)
  obStep++
  obRender()
}

function obPrev() {
  if (obFinished) return
  if (obStep > 0) {
    obStep--
    obSearch = ''
    obRender()
  }
}

async function obSkip() {
  try {
    await api('/onboarding', { method: 'POST', body: JSON.stringify({ skip: true }) })
    state.onboarding = { completed: true, skipped: true }
  } catch {}
  $('onboarding').classList.remove('open')
  toast('以后可以在设置里重新引导', '')
}

function obInit() {
  if (!state.onboarding || state.onboarding.completed) return
  obStep = 0
  obAdult = false
  obAnswers = {}
  obCustomOpen = {}
  obGroup = {}
  obSearch = ''
  obFinished = false
  $('onboarding').classList.add('open')
  $('ob-skip').style.display = ''
  obRender()
}

$('ob-options').addEventListener('click', (e) => {
  const adultBtn = e.target.closest('[data-adult]')
  if (adultBtn) {
    obAdult = adultBtn.dataset.adult === 'adult'
    obRenderAdult()
    return
  }
  const id = obSteps()[obStep]
  const q = OB_QUESTIONS.find((x) => x.id === id)
  if (!q) return
  const tab = e.target.closest('[data-group]')
  if (tab) {
    obGroup[q.id] = Number(tab.dataset.group)
    obSearch = ''
    obRender(false)
    return
  }
  const optBtn = e.target.closest('[data-option]')
  if (optBtn) {
    const found = obFindOption(q.id, optBtn.dataset.option)
    if (!found) return
    const groupKey = q.type === 'context' ? found.group?.key : ''
    obToggleOption(q, found.opt, groupKey)
    obBounce()
    obRender(false)
    return
  }
  if (e.target.closest('[data-other]')) {
    obCustomOpen[q.id] = !obCustomOpen[q.id]
    obRender(false)
    return
  }
})

$('ob-options').addEventListener('input', (e) => {
  if (e.target.id === 'ob-search') {
    const pos = e.target.selectionStart
    obSearch = e.target.value
    obRender(false)
    const s = $('ob-search')
    if (s) {
      s.focus()
      try { s.setSelectionRange(pos, pos) } catch {}
    }
    return
  }
  if (e.target.id === 'ob-custom') {
    const id = obSteps()[obStep]
    const ans = obAns(id)
    ans.custom = e.target.value
    const counter = e.target.parentElement?.querySelector('.ob-count')
    if (counter) counter.textContent = `${e.target.value.length} / 80`
    return
  }
  if (e.target.id === 'ob-supplement') {
    const counter = e.target.parentElement?.querySelector('.ob-count')
    if (counter) counter.textContent = `${e.target.value.length} / 200`
  }
})

$('ob-next').addEventListener('click', obNext)
$('ob-back').addEventListener('click', obPrev)
$('ob-skip').addEventListener('click', obSkip)


load().catch((e) => {
  $('status').textContent = '加载失败'
  toast(`加载失败：${e.message}`, 'error')
})
