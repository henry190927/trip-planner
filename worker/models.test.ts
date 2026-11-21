import { describe, expect, it } from 'vitest'
import type { Env } from './env'
import { availableModels, modelLabel, modelStatus } from './gemini'

function fakeEnv(cooling: Record<string, string> = {}) {
  const kv = new Map(Object.entries(cooling).map(([m, s]) => [`cooldown:${m}`, s]))
  return {
    MODEL: 'gemini-3.6-flash',
    FALLBACK_MODELS: 'gemini-3.1-flash-lite, gemini-flash-lite-latest',
    TRIPS: { get: async (k: string) => kv.get(k) ?? null },
  } as unknown as Env
}

describe('選模型', () => {
  it('沒選：照預設順序；選了：選的排第一，其他照原本順序當備用', async () => {
    expect(await availableModels(fakeEnv())).toEqual(['gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'])
    expect(await availableModels(fakeEnv(), 'gemini-3.1-flash-lite')).toEqual(['gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-flash-lite-latest'])
  })

  it('不在清單裡的模型不理會（不能用請求指定任意模型）', async () => {
    expect((await availableModels(fakeEnv(), 'gemini-ultra-secret'))[0]).toBe('gemini-3.6-flash')
  })

  it('選的模型額度用完（冷卻中）時直接跳過', async () => {
    expect(await availableModels(fakeEnv({ 'gemini-3.1-flash-lite': '429' }), 'gemini-3.1-flash-lite')).toEqual(['gemini-3.6-flash', 'gemini-flash-lite-latest'])
  })

  it('給畫面看的名稱與狀態', async () => {
    expect(modelLabel('gemini-3.6-flash')).toBe('Gemini 3.6 Flash')
    expect(modelLabel('gemini-3.1-flash-lite')).toBe('Gemini 3.1 Flash-Lite')
    expect(modelLabel('gemini-flash-lite-latest')).toBe('Gemini Flash-Lite（最新）')
    expect((await modelStatus(fakeEnv({ 'gemini-3.6-flash': '429' })))[0]).toEqual({ id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', cooling: 429 })
  })
})
