import { Fragment, type ReactNode } from 'react'

// 小幫手回覆的簡易排版：段落、條列、**粗體**、[連結](url) 與網址。不支援的語法照原文顯示。
const inline = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s)）]+)/g

function renderInline(text: string): ReactNode[] {
  return text.split(inline).map((chunk, i) => {
    if (chunk.startsWith('**') && chunk.endsWith('**')) return <strong key={i}>{chunk.slice(2, -2)}</strong>
    const link = chunk.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    const url = link?.[2] ?? (/^https?:\/\//.test(chunk) ? chunk : undefined)
    if (url)
      return (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="break-all font-bold text-sky-ink underline">
          {link?.[1] ?? chunk}
        </a>
      )
    return <Fragment key={i}>{chunk}</Fragment>
  })
}

export default function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    blocks.push(
      <ul key={blocks.length} className="my-1 space-y-1 pl-1">
        {list.map((li, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-peach-ink/60" />
            <span>{renderInline(li)}</span>
          </li>
        ))}
      </ul>,
    )
    list = []
  }
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      list.push(bullet[1])
      continue
    }
    flush()
    if (!line.trim()) continue
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    blocks.push(
      <p key={blocks.length} className={heading ? 'mt-1 font-black' : ''}>
        {renderInline(heading ? heading[1] : line)}
      </p>,
    )
  }
  flush()
  return <div className="space-y-1.5">{blocks}</div>
}
