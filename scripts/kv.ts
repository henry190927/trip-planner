// 讓本機腳本用 wrangler（用你自己登入的 Cloudflare 帳號）讀寫線上的 KV。
// 介面跟 Worker 裡的 env.TRIPS 一樣，所以可以直接沿用 worker/store.ts 的函式。
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Env } from '../worker/env'

const target = process.env.KV_LOCAL ? ['--local', '--persist-to', process.env.KV_LOCAL] : ['--remote']

function wrangler(args: string[]) {
  return execFileSync('npx', ['wrangler', 'kv', 'key', ...args, '--binding', 'TRIPS', ...target], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function get(key: string, type?: 'json' | 'text') {
  let out: string
  try {
    out = wrangler(['get', key])
  } catch (e) {
    // 沒有這個 key：線上的 KV 回 404
    if (String((e as { stderr?: string }).stderr ?? e).includes('404')) return null
    throw e
  }
  // 本機模擬的 KV 則是印出這行
  if (out.trim() === 'Value not found') return null
  return type === 'json' ? JSON.parse(out) : out
}

async function put(key: string, value: string, options?: { expirationTtl?: number }) {
  const dir = mkdtempSync(join(tmpdir(), 'trip-kv-'))
  const file = join(dir, 'value')
  try {
    writeFileSync(file, value)
    wrangler(['put', key, '--path', file, ...(options?.expirationTtl ? ['--ttl', String(options.expirationTtl)] : [])])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function del(key: string) {
  wrangler(['delete', key])
}

export const env = { TRIPS: { get, put, delete: del } } as unknown as Env

/** 網站網址（邀請連結用） */
export const SITE = process.env.SITE_URL ?? 'https://trip-chat.travel-planner-hm1d.workers.dev'
