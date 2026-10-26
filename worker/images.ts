// 聊天附圖的檢查：網站送來的已經在手機上縮過，這裡只擋異常的請求
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
/** base64 長度上限：約 2MB 的圖 */
const MAX_IMAGE_BASE64 = 2_800_000

export function imageError(images: unknown[]): string | undefined {
  if (images.length > 3) return '一次最多附 3 張圖'
  for (const i of images as { mimeType?: unknown; data?: unknown }[]) {
    if (typeof i?.mimeType !== 'string' || !IMAGE_TYPES.includes(i.mimeType)) return '只能附 JPEG、PNG 或 WebP 圖片'
    if (typeof i.data !== 'string' || !i.data || i.data.length > MAX_IMAGE_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(i.data))
      return '圖片太大或格式不對'
  }
  return undefined
}
