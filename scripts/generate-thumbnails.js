/**
 * Generates 400px-wide thumbnail versions of gallery photos.
 * Run: node scripts/generate-thumbnails.js
 * Output: src/assets/photos/thumbnails/*.png
 */
import sharp from 'sharp'
import { readdir, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PHOTOS_DIR = join(__dirname, '../src/assets/photos')
const THUMB_DIR = join(PHOTOS_DIR, 'thumbnails')
const THUMB_WIDTH = 400

async function main() {
  await mkdir(THUMB_DIR, { recursive: true })
  const files = await readdir(PHOTOS_DIR)
  const pngs = files.filter((f) => f.endsWith('.png'))

  for (const file of pngs) {
    const inputPath = join(PHOTOS_DIR, file)
    const outputPath = join(THUMB_DIR, file)
    await sharp(inputPath)
      .resize(THUMB_WIDTH, null, { withoutEnlargement: true })
      .png({ quality: 80 })
      .toFile(outputPath)
    console.log(`Generated ${file}`)
  }
  console.log(`Done. ${pngs.length} thumbnails in ${THUMB_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
