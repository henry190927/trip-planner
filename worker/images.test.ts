import { describe, expect, it } from 'vitest'
import { imageError } from './images'

describe('imageError', () => {
  const ok = { mimeType: 'image/jpeg', data: 'aGVsbG8=' }
  it('正常的圖片通過', () => expect(imageError([ok, ok, ok])).toBeUndefined())
  it('超過 3 張、格式不對、太大、不是 base64 都擋下', () => {
    expect(imageError([ok, ok, ok, ok])).toContain('最多')
    expect(imageError([{ ...ok, mimeType: 'image/gif' }])).toContain('JPEG')
    expect(imageError([{ ...ok, data: 'a'.repeat(2_800_001) }])).toContain('太大')
    expect(imageError([{ ...ok, data: '<script>' }])).toContain('格式')
    expect(imageError([null])).toContain('JPEG')
  })
})
