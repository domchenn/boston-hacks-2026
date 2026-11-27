/**
 * The photo cleaner with real images (sharp): GPS and camera metadata are gone from
 * the stored JPEG, the camera's rotation is applied first, big photos shrink to
 * 1600 px, transparent PNGs get a white background, and anything that isn't a
 * supported image (text, SVG, GIF, a truncated JPEG, over 5 MB) is refused.
 */
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common'
import { cleanImage, MAX_SIDE } from '../src/photos/image-cleaner.js'

const solid = (width: number, height: number, channels: 3 | 4 = 3) =>
  sharp({ create: { width, height, channels, background: channels === 4 ? { r: 0, g: 0, b: 0, alpha: 0 } : '#3366aa' } })

/** A phone-style JPEG: GPS coordinates, camera details and "rotate 90°" in its EXIF. */
async function phoneJpeg(width = 400, height = 200) {
  return solid(width, height)
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestPhone', Model: 'Camera 1' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '42/1 21/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '71/1 3/1 0/1' },
    })
    // sharp sets the orientation tag itself (an Orientation inside withExif is ignored).
    .withMetadata({ orientation: 6 })
    .toBuffer()
}

describe('cleanImage', () => {
  it('drops GPS and every other kind of metadata', async () => {
    const input = await phoneJpeg()
    const before = await sharp(input).metadata()
    expect(before.exif?.toString('latin1')).toContain('TestPhone')
    expect(before.orientation).toBe(6)
    const meta = await sharp(await cleanImage(input)).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.exif).toBeUndefined()
    expect(meta.xmp).toBeUndefined()
    expect(meta.iptc).toBeUndefined()
    expect(meta.orientation).toBeUndefined()
  })

  it('applies the camera’s rotation before dropping it', async () => {
    const meta = await sharp(await cleanImage(await phoneJpeg(400, 200))).metadata()
    expect([meta.width, meta.height]).toEqual([200, 400])
  })

  it('shrinks the longest side to 1600 px and never enlarges', async () => {
    const big = await sharp(await cleanImage(await solid(4000, 3000).png().toBuffer())).metadata()
    expect([big.width, big.height]).toEqual([MAX_SIDE, 1200])
    const small = await sharp(await cleanImage(await solid(300, 500).webp().toBuffer())).metadata()
    expect([small.width, small.height]).toEqual([300, 500])
  })

  it('turns a transparent PNG into a JPEG on white', async () => {
    const out = await cleanImage(await solid(10, 10, 4).png().toBuffer())
    const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true })
    expect(info.channels).toBe(3)
    expect([data[0], data[1], data[2]].every((v) => v! > 245)).toBe(true)
  })

  it.each([
    ['text', Buffer.from('hello, this is not an image')],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')],
  ])('refuses %s with 415', async (_label, input) => {
    await expect(cleanImage(input)).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
  })

  it('refuses a GIF and a truncated JPEG with 415', async () => {
    await expect(cleanImage(await solid(10, 10).gif().toBuffer())).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
    const jpeg = await solid(800, 800).jpeg().toBuffer()
    await expect(cleanImage(jpeg.subarray(0, Math.floor(jpeg.length / 2)))).rejects.toBeInstanceOf(UnsupportedMediaTypeException)
  })

  it('refuses more than 5 MB with 413', async () => {
    await expect(cleanImage(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toBeInstanceOf(PayloadTooLargeException)
  })
})
