// 聊天附圖：在手機上先縮小再上傳。截圖上的字要看得清楚，所以長邊留到 2048；
// 另外做一張小縮圖存在聊天紀錄裡顯示。

export interface PreparedImage {
  mimeType: 'image/jpeg'
  /** base64，不含 data: 前綴 */
  data: string
  /** 顯示用的小縮圖（data URL） */
  thumb: string
}

export const MAX_IMAGES = 3

function draw(bitmap: ImageBitmap, longSide: number, quality: number) {
  const scale = Math.min(1, longSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  // JPEG 沒有透明：先鋪白底，透明的截圖才不會變黑
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('只能傳圖片')
  const bitmap = await createImageBitmap(file)
  try {
    const full = draw(bitmap, 2048, 0.82)
    return { mimeType: 'image/jpeg', data: full.slice(full.indexOf(',') + 1), thumb: draw(bitmap, 240, 0.7) }
  } finally {
    bitmap.close()
  }
}
