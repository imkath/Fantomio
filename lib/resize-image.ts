// Turns any photo someone picks into a small square WebP before it leaves the browser: the
// bucket only takes 512 KB, and a 256 px avatar is all the app ever shows.
export class AvatarError extends Error {}

export async function squareAvatar(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new AvatarError('No pudimos leer esa imagen. Prueba con otra foto (JPG, PNG o WebP).')
  })
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AvatarError('No pudimos procesar la imagen. Prueba con otra.')
  // Center crop to a square, then scale down.
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size
  )
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new AvatarError('No pudimos procesar la imagen. Prueba con otra.')),
      'image/webp',
      0.85
    )
  )
}
