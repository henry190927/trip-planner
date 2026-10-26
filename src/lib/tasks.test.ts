import { describe, expect, it } from 'vitest'
import { seoul2026 } from '../trips/seoul-2026-11'
import { applyOps } from './ops'
import { canSee, hidePrivate } from './visibility'

const day2 = '2026-11-07'
const surprise = {
  time: '19:00',
  end: '19:40',
  kind: 'task' as const,
  title: '外帶 MISS 豬腳回住宿',
  who: ['me'],
  todo: { done: false },
  for: { time: '21:30', title: 'MISS 豬腳宵夜' },
  private: true,
}
const withTask = () => applyOps(seoul2026, [{ op: 'add_item', date: day2, item: surprise }])

describe('小任務', () => {
  it('私人小任務：只有負責人選自己時看得到，選「全部」也看不到', () => {
    const task = withTask().trip.days[1].items.find((i) => i.title === surprise.title)!
    expect(canSee(task, 'me')).toBe(true)
    expect(canSee(task, 'her')).toBe(false)
    expect(canSee(task, undefined)).toBe(false)
  })

  it('修改紀錄不寫私人小任務的內容', () => {
    const r = withTask()
    expect(r.errors).toEqual([])
    expect(r.changes[0].text).toBe('11/7 19:00的私人小任務')
    expect(JSON.stringify(r.changes)).not.toContain('豬腳')
  })

  it('打勾完成、改回來；不是小任務的項目不能打勾', () => {
    const base = withTask().trip
    const done = applyOps(base, [{ op: 'complete_task', date: day2, title: surprise.title, done: true }])
    expect(done.errors).toEqual([])
    const task = done.trip.days[1].items.find((i) => i.title === surprise.title)!
    expect(task.todo).toMatchObject({ done: true })
    expect(task.todo!.doneAt).toBeTruthy()
    expect(done.changes[0].text).toBe('11/7 19:00的私人小任務：完成')
    const undone = applyOps(done.trip, [{ op: 'complete_task', date: day2, title: surprise.title, done: false }])
    expect(undone.trip.days[1].items.find((i) => i.title === surprise.title)!.todo).toEqual({ done: false })
    expect(applyOps(base, [{ op: 'complete_task', date: day2, title: 'MISS 豬腳宵夜', done: true }]).errors[0]).toContain('不是小任務')
  })

  it('私人項目一定要有負責人', () => {
    const r = applyOps(seoul2026, [{ op: 'add_item', date: day2, item: { ...surprise, who: undefined } }])
    expect(r.errors.join()).toContain('要填負責人')
  })

  it('交給小樹前拿掉別人的私人項目，自己的留著', () => {
    const trip = withTask().trip
    const titles = (t: typeof trip) => t.days[1].items.map((i) => i.title)
    expect(titles(hidePrivate(trip, 'her'))).not.toContain(surprise.title)
    expect(titles(hidePrivate(trip, undefined))).not.toContain(surprise.title)
    expect(titles(hidePrivate(trip, 'me'))).toContain(surprise.title)
    // 沒有私人項目時原封不動
    expect(hidePrivate(seoul2026, 'her')).toBe(seoul2026)
  })
})
