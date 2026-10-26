import { describe, expect, it } from 'vitest'
import { opsSchema } from '../schema'
import { seoul2026 } from '../trips/seoul-2026-11'
import { applyOps } from './ops'
import { spotOps, toForm } from './spotForm'

const jokbal = seoul2026.spots!.find((s) => s.id === 'miss-jokbal')!
const run = (ops: unknown[]) => applyOps(seoul2026, opsSchema.parse(ops))

describe('spotOps', () => {
  it('沒改任何東西就不送', () => {
    expect(spotOps(seoul2026, toForm(jokbal), jokbal)).toEqual([])
  })

  it('只送有改的欄位；清空代表刪掉；標籤用頓號或逗號分開', () => {
    const ops = spotOps(seoul2026, { ...toForm(jokbal), verify: '', tags: '豬腳, 宵夜、可外帶', note: '慶祝用' }, jokbal)
    expect(ops).toEqual([{ op: 'update_spot', ref: 'miss-jokbal', spotChanges: { note: '慶祝用', verify: null, tags: ['豬腳', '宵夜', '可外帶'] } }])
    const r = run(ops)
    expect(r.errors).toEqual([])
    const after = r.trip.spots!.find((s) => s.id === 'miss-jokbal')!
    expect(after.verify).toBeUndefined()
    expect(after.tags).toEqual(['豬腳', '宵夜', '可外帶'])
  })

  it('改營業時間會記今天確認，並拿掉可能已經不對的營業時段', () => {
    const withOpen = { ...jokbal, open: [{ days: [6], from: '12:30', to: '24:00' }] }
    const ops = spotOps(seoul2026, { ...toForm(withOpen), hours: '11:00–23:00' }, withOpen)
    const changes = (ops[0] as { spotChanges: Record<string, unknown> }).spotChanges
    expect(changes.hours).toBe('11:00–23:00')
    expect(changes.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(changes.open).toBeNull()
  })

  it('改地圖連結會換掉整個 place，其他欄位（地址）保留；清空當地名稱會拿掉', () => {
    const ops = spotOps(seoul2026, { ...toForm(jokbal), mapLink: 'https://naver.me/abc', local: '' }, jokbal)
    const place = (ops[0] as unknown as { spotChanges: { place: Record<string, unknown> } }).spotChanges.place
    expect(place).toEqual({ name: 'MISS 豬腳 弘大店', addressLocal: jokbal.place.addressLocal, mapQuery: jokbal.place.mapQuery, mapLink: 'https://naver.me/abc' })
    expect(run(ops).errors).toEqual([])
  })

  it('新增：只帶有填的欄位', () => {
    const ops = spotOps(seoul2026, { ...toForm(), name: '測試咖啡', category: 'cafe', area: '弘大', tags: '' })
    expect(ops).toEqual([{ op: 'add_spot', spot: { place: { name: '測試咖啡' }, category: 'cafe', area: '弘大' } }])
    const r = run(ops)
    expect(r.errors).toEqual([])
    expect(r.trip.spots!.at(-1)!.place.name).toBe('測試咖啡')
  })
})
