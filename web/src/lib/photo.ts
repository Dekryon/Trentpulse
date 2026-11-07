// Shrinks a camera photo on the phone before it is sent: longest side 768 px,
// JPEG at 70% quality, usually around 100 KB. Faster on mobile data, and enough
// detail to judge how full a room is.
export async function shrinkPhoto(file: File, maxSide = 768): Promise<{ data: string; mimeType: 'image/jpeg' }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error("This photo format isn't supported. Try a regular camera photo.")
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error("Couldn't read the photo. Pick a level yourself.")
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: 'image/jpeg' }
}
