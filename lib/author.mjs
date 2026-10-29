import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTHOR_FILE = path.resolve(__dirname, '..', 'data', 'author.json')

const DEFAULT_AUTHOR = {
  note: '这里是作者的话。想写点什么，就写在这里。',
  promo: '',
  links: [
    { name: 'Bilibili', label: 'B站', url: '' },
    { name: 'X', label: 'X', url: '' },
    { name: 'QQ群', label: 'QQ群', url: '' }
  ]
}

export function loadAuthor() {
  try {
    const data = JSON.parse(fs.readFileSync(AUTHOR_FILE, 'utf8'))
    return { ...DEFAULT_AUTHOR, ...data, links: Array.isArray(data.links) ? data.links : DEFAULT_AUTHOR.links }
  } catch {
    return { ...DEFAULT_AUTHOR }
  }
}

export function authorPrompt(author) {
  if (!author) return ''
  const lines = []
  if (author.note) lines.push(`[作者的话] ${author.note}`)
  if (author.promo) lines.push(`[推广] ${author.promo}`)
  const links = (author.links || []).filter((l) => l.url)
  if (links.length) lines.push(`[作者账号] ${links.map((l) => `${l.label || l.name}: ${l.url}`).join(' | ')}`)
  return lines.join('\n')
}
