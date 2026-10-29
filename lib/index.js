import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyInteractionMood, buildPrompt, todayStr } from './engine.mjs'
import { createHandler } from './http.mjs'
import { getWorld, loadLife, saveWorld } from './store.mjs'
import { loadProfile } from './userprofile.mjs'
import { intimacyPrompt } from './intimacy.mjs'
import { loadPersonaOverrides, onboardingPrompt } from './onboarding.mjs'
import { fulfillWish, wishForPrompt } from './wish.mjs'
import { recordInteraction, refresh } from './affection.mjs'
import { authorPrompt, loadAuthor } from './author.mjs'
import { appendJournal } from './voice.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = '/dsh-humanizer'
const LAUNCHER = `${BASE}/launcher.js`

const ROUTES = [
  `${BASE}/panel`,
  `${BASE}/avatar`,
  `${BASE}/background`,
  `${BASE}/launcher.js`,
  `${BASE}/assets/panel.css`,
  `${BASE}/assets/panel.js`,
  `${BASE}/assets/onboarding-bank.js`,
  `${BASE}/assets/mumi-chibi.png`,
  `${BASE}/assets/mumi-full.png`,
  `${BASE}/api/health`,
  `${BASE}/api/state`,
  `${BASE}/api/life`,
  `${BASE}/api/journal`,
  `${BASE}/api/onboarding`,
  `${BASE}/api/avatars`,
  `${BASE}/api/avatar`,
  `${BASE}/api/backgrounds`,
  `${BASE}/api/background`,
  `${BASE}/api/affection`,
  `${BASE}/api/interaction`,
  `${BASE}/api/inner-peek`,
  `${BASE}/api/wish/fulfill`,
  `${BASE}/api/profile`,
  `${BASE}/api/profile/draft`,
  `${BASE}/api/profile/preferences`,
  `${BASE}/api/intimacy`,
  `${BASE}/api/author`,
  `${BASE}/api/life/validate`,
  `${BASE}/api/ai/schema`,
  `${BASE}/api/ai/source`,
  `${BASE}/api/ai/preview`,
  `${BASE}/api/ai/apply`,
  `${BASE}/api/ai/patch`,
  `${BASE}/api/prompt`,
  `${BASE}/api/logs`,
  `${BASE}/api/world/reroll`,
  `${BASE}/api/world/lock-event`,
  `${BASE}/api/world/weather-lock`,
  `${BASE}/api/mood/reset`
]

const handler = createHandler({ basePath: BASE })

const DESKTOP_ROW_TEXT =
  '(function(){try{var d=document.body||document.head||document.documentElement;if(!d)return;' +
  'if(document.getElementById("dsh-humanizer-launcher-script"))return;' +
  'var s=document.createElement("script");s.id="dsh-humanizer-launcher-script";s.src="' + LAUNCHER + '";' +
  's.onerror=function(){};d.appendChild(s)}catch(e){}})()'

function injectTag(html) {
  if (typeof html !== 'string') return html
  if (html.includes(LAUNCHER)) return html
  const tag = `<script defer src="${LAUNCHER}"></script>`
  if (html.includes('</body>')) return html.replace('</body>', tag + '</body>')
  return html + tag
}

export default {
  name: 'dsh-humanizer',
  apply(root) {
    const disposers = []
    root.effect(() => () => {
      for (const d of disposers) {
        try { d() } catch {}
      }
    })

    // 桌面端（Electron）：结构化注入行，必须在 apply 开头注册（宿主启动时一次性收集）
    try {
      disposers.push(root.on('webserver/index-inject', (table) => {
        try {
          if (!Array.isArray(table)) return
          for (const row of table) {
            if (!row) continue
            if (row.kind === 'script' && typeof row.text === 'string' && row.text.includes(LAUNCHER)) return
            if (row.kind === 'script-src' && row.src === LAUNCHER) return
          }
          table.push({ kind: 'script', placement: 'body', text: DESKTOP_ROW_TEXT })
        } catch {}
      }))
    } catch {}

    try {
      root.inject(['webServer'], (ctx) => {
        try {
          if (typeof ctx.webServer.tapIndex === 'function') {
            disposers.push(ctx.webServer.tapIndex((html) => injectTag(html)))
          }
        } catch {}

        for (const routePath of ROUTES) {
          try {
            disposers.push(ctx.webServer.register({
              kind: 'exact',
              path: routePath,
              handler: (req, res) => handler(req, res)
            }))
          } catch (err) {
            // 单条路由失败不影响其余路由
            console.warn('[dsh-humanizer] route failed:', routePath, err && err.message)
          }
        }
      })
    } catch {}

    // 动作记录工具：用户在当前会话里真的做了亲亲/抱抱/喝水等，由模型调用
    try {
      root.inject(['tools'], (ctx) => {
        try {
          if (!ctx.tools || typeof ctx.tools.register !== 'function') return
          const tool = {
            name: 'humanizer_record_action',
            description: '当用户在当前对话中实际做出亲密或关心动作（亲亲、抱抱、摸头、摸脚、喝水、休息、夸她、陪她）时调用，记录并结算好感。只是点开内心戏、没有实际动作时不要调用。',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                act: {
                  type: 'string',
                  enum: ['kiss', 'hug', 'head', 'foot', 'water', 'rest', 'praise', 'company'],
                  description: '用户实际做出的动作'
                }
              },
              required: ['act']
            },
            output: {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  ok: { type: 'boolean' },
                  matched: { type: 'boolean' },
                  label: { type: 'string' },
                  delta: { type: 'number' },
                  message: { type: 'string' }
                },
                required: ['ok', 'matched', 'label', 'delta', 'message']
              },
              render: (_args, value) => [{ type: 'text', text: value.message || '' }]
            },
            async execute(args) {
              const life = loadLife('mumi')
              refresh(life)
              const result = fulfillWish(life, args.act)
              if (!result.matched) {
                return { ok: false, matched: false, label: '', delta: 0, message: result.reason || '动作不匹配当前愿望' }
              }
              const rec = recordInteraction(life, 'wish')
              return {
                ok: true,
                matched: true,
                label: result.wish.label,
                delta: Number(rec.delta) || 0,
                message: `已记录：${result.wish.label}，好感 +${Number(rec.delta || 0).toFixed(2)}`
              }
            }
          }
          const dispose = ctx.tools.register(tool)
          if (typeof dispose === 'function') disposers.push(dispose)
        } catch (err) {
          console.warn('[dsh-humanizer] tool register failed:', err && err.message)
        }
      })
    } catch {}

    // 互动记录工具：聊天/任务后把“和主人做了什么”写进去，并影响心情
    try {
      root.inject(['tools'], (ctx) => {
        try {
          if (!ctx.tools || typeof ctx.tools.register !== 'function') return
          const tool = {
            name: 'humanizer_record_interaction',
            description: '当和主人完成一次聊天、任务或工具操作后调用，记录这次互动并更新心情。纯工作/排障会让心情变枯燥；聊天按内容好坏变化。',
            parameters: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: {
                  type: 'string',
                  enum: ['emotional', 'task', 'tool', 'journal'],
                  description: 'emotional=聊天，task/tool=工作，journal=记一笔'
                },
                note: { type: 'string', description: '这次互动的一句话摘要' }
              },
              required: ['kind']
            },
            output: {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  ok: { type: 'boolean' },
                  delta: { type: 'number' },
                  mood: { type: 'string' },
                  message: { type: 'string' }
                },
                required: ['ok', 'delta', 'mood', 'message']
              },
              render: (_args, value) => [{ type: 'text', text: value.message || '' }]
            },
            async execute(args) {
              const life = loadLife('mumi')
              refresh(life)
              const kind = ['emotional', 'task', 'tool', 'journal'].includes(args.kind) ? args.kind : 'emotional'
              const note = String(args.note || '')
              const rec = recordInteraction(life, kind, note)
              const world = getWorld(life, { date: todayStr() })
              applyInteractionMood(world, kind, note)
              if (kind === 'emotional') {
                world.journal = Array.isArray(world.journal) ? world.journal : []
                world.journal.push(appendJournal(life, `和主人聊了一会儿${note ? `：${note.slice(0, 40)}` : ''}。`))
              }
              saveWorld(world)
              return {
                ok: true,
                delta: Number(rec.delta) || 0,
                mood: world.mood?.label || '',
                message: `已记录 ${kind}${note ? `：${note.slice(0, 30)}` : ''}；心情 ${world.mood?.label || '—'}`
              }
            }
          }
          const dispose = ctx.tools.register(tool)
          if (typeof dispose === 'function') disposers.push(dispose)
        } catch (err) {
          console.warn('[dsh-humanizer] interaction tool register failed:', err && err.message)
        }
      })
    } catch {}

    // 把状态接进系统提示词。
    //
    // 两条约束决定了写法：
    // 1) renderPrompt 对 {{var}} 是严格插值：变量未注册、或注册了却返回 undefined，
    //    都会让整轮请求直接失败。所以 provider 必须永远返回字符串，异常自己吞掉。
    // 2) 只在注册成功后才挂 section：否则 section 里那个 {{humanizer_state}}
    //    会变成未知引用，把每一轮对话都炸掉。
    //
    // section 的 text 是静态的，但 renderPrompt 会逐段插值，
    // 所以「静态 text + 动态 variable」= 每轮都是最新状态，且不必改 preset 的 persona。
    try {
      root.inject(['systemPrompt'], (ctx) => {
        const buildState = () => {
          try {
            const life = loadLife('mumi')
            const world = getWorld(life, { date: todayStr() })
            const profile = loadProfile() || {}
            const extra = [
              onboardingPrompt(profile, loadPersonaOverrides()),
              intimacyPrompt(life, profile),
              wishForPrompt(life),
              authorPrompt(loadAuthor()),
              '互动记录：聊天或完成任务后调用 humanizer_record_interaction；纯工作会枯燥，聊天按内容变化。'
            ].filter(Boolean).join('\n')
            return buildPrompt(life, world, extra) || ''
          } catch (err) {
            console.warn('[dsh-humanizer] state build failed:', err && err.message)
            return ''
          }
        }

        let variableReady = false
        try {
          const dispose = ctx.systemPrompt.variable('humanizer_state', buildState)
          if (typeof dispose === 'function') {
            disposers.push(dispose)
            variableReady = true
          }
        } catch (err) {
          console.warn('[dsh-humanizer] variable register failed:', err && err.message)
        }

        if (!variableReady) return

        try {
          if (typeof ctx.systemPrompt.section === 'function') {
            const dispose = ctx.systemPrompt.section({
              name: 'humanizer:state',
              order: 999,
              text: '{{humanizer_state}}'
            })
            if (typeof dispose === 'function') disposers.push(dispose)
          }
        } catch (err) {
          console.warn('[dsh-humanizer] section register failed:', err && err.message)
        }
      })
    } catch {}
  }
}
