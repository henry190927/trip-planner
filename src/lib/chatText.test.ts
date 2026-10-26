import { describe, expect, it } from 'vitest'
import type { Message } from './chatStore'
import { conversationText, messageText, toPlain } from './chatText'

describe('toPlain', () => {
  it('去掉排版符號，連結改成「文字（網址）」', () => {
    const md = '### 店家資訊\n**地址**：홍익로6길 52\n- 營業 12:00–23:00\n---\n訂位看 [CatchTable](https://catchtable.example/a) 或 https://naver.me/x'
    expect(toPlain(md)).toBe('店家資訊\n地址：홍익로6길 52\n・營業 12:00–23:00\n訂位看 CatchTable（https://catchtable.example/a） 或 https://naver.me/x')
  })
})

describe('messageText / conversationText', () => {
  const user: Message = { id: '1', role: 'user', text: '豬腳營業到幾點？' }
  const bot: Message = {
    id: '2',
    role: 'assistant',
    text: '營業到 **24:00**。',
    sources: [{ title: '다이닝코드', url: 'https://diningcode.example/a' }],
    proposals: [
      {
        state: 'pending',
        proposal: {
          id: 'p',
          summary: '補上營業時間',
          ops: [],
          baseVersion: 1,
          changes: [{ kind: 'update', text: '11/7 21:30「MISS 豬腳」：備註' }],
        },
      },
    ],
  }

  it('小樹的回覆附上建議修改與來源', () => {
    expect(messageText(bot)).toBe('營業到 24:00。\n\n建議修改：補上營業時間\n・修改 11/7 21:30「MISS 豬腳」：備註\n\n來源：\n・다이닝코드 https://diningcode.example/a')
  })

  it('整段對話標出誰說的，略過還在輸入中的', () => {
    const typing: Message = { id: '3', role: 'assistant', text: '', streaming: true }
    expect(conversationText([user, bot, typing])).toBe(`我：\n豬腳營業到幾點？\n\n小樹：\n${messageText(bot)}`)
  })
})
