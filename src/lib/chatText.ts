import type { Message } from './chatStore'

// 複製聊天內容用：把小樹回覆裡的排版符號換成一般文字，貼到 LINE 或備忘錄才不會冒出 ** 和 [](…)

const kindText = { add: '新增', update: '修改', remove: '刪除' } as const

export function toPlain(markdown: string) {
  return markdown
    .split('\n')
    .filter((line) => !/^\s*(-{3,}|\*{3,})\s*$/.test(line))
    .map((line) =>
      line
        .replace(/^#{1,4}\s+/, '')
        .replace(/^(\s*)[-*•]\s+/, '$1・')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, text: string, url: string) => (text === url ? url : `${text}（${url}）`)),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 一則訊息的純文字；小樹的回覆會附上來源與建議修改 */
export function messageText(m: Message) {
  if (m.role === 'user') return m.text.trim()
  const parts = [toPlain(m.text)]
  for (const p of m.proposals ?? []) {
    const lines = p.proposal.changes.map((c) => `・${kindText[c.kind]} ${c.text}`)
    parts.push([`建議修改：${p.proposal.summary}`, ...lines].join('\n'))
  }
  if (m.sources?.length) parts.push(['來源：', ...m.sources.map((s) => `・${s.title} ${s.url}`)].join('\n'))
  return parts.filter(Boolean).join('\n\n')
}

/** 整段對話 */
export function conversationText(messages: Message[]) {
  return messages
    .filter((m) => !m.streaming)
    .map((m) => ({ who: m.role === 'user' ? '我' : '小樹', text: messageText(m) }))
    .filter((m) => m.text)
    .map((m) => `${m.who}：\n${m.text}`)
    .join('\n\n')
}

/** 寫進剪貼簿。用區網 IP 開發時不是安全連線，navigator.clipboard 不能用，改用舊方法 */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}
