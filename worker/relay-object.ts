import { DurableObject } from 'cloudflare:workers'
import type { Env } from './env'

/** 固定在美西的轉發器，用法與原因見 relay.ts */
export class GeminiRelay extends DurableObject<Env> {
  async fetch(req: Request) {
    return fetch(req)
  }
}
