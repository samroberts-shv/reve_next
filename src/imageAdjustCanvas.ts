import type { AdjustParams } from './adjustParams'
import { applyAdjustmentsToBuffer } from './adjustLogic'

/** Max width when no target is specified. */
const DEFAULT_MAX_WIDTH = 1920

/**
 * Draw the image onto a canvas with adjustments applied.
 * Uses display-sized canvas (capped at DEFAULT_MAX_WIDTH) for performance.
 */
export function drawAdjustedImage(
  sourceImage: HTMLImageElement,
  params: AdjustParams,
  targetWidth?: number,
  targetHeight?: number,
): HTMLCanvasElement {
  const nw = sourceImage.naturalWidth
  const nh = sourceImage.naturalHeight
  if (nw === 0 || nh === 0) {
    const empty = document.createElement('canvas')
    empty.width = 1
    empty.height = 1
    return empty
  }
  let w = targetWidth ?? Math.min(nw, DEFAULT_MAX_WIDTH)
  let h = targetHeight ?? Math.round((nh * w) / nw)
  if (targetWidth && !targetHeight) {
    h = Math.round((nh * w) / nw)
  } else if (!targetWidth && targetHeight) {
    w = Math.round((nw * h) / nh)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.drawImage(sourceImage, 0, 0, w, h)
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch {
    return canvas
  }
  const len = w * h * 4
  applyAdjustmentsToBuffer(imageData.data, len, params)
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

let workerInstance: Worker | null = null
let workerRunId = 0

function getWorker(): Worker | null {
  if (workerInstance != null) return workerInstance
  try {
    workerInstance = new Worker(
      new URL('./adjustWorker.ts', import.meta.url),
      { type: 'module' },
    )
    return workerInstance
  } catch {
    return null
  }
}

/**
 * Produce a blob URL for the adjusted image using a Web Worker when available.
 * Falls back to main-thread processing if the worker is unavailable.
 */
export function adjustedImageToBlobURL(
  sourceImage: HTMLImageElement,
  params: AdjustParams,
  targetWidth?: number,
  targetHeight?: number,
  mimeType: string = 'image/jpeg',
  quality: number = 0.92,
): Promise<string> {
  const nw = sourceImage.naturalWidth
  const nh = sourceImage.naturalHeight
  if (nw === 0 || nh === 0) {
    return Promise.reject(new Error('Image not loaded'))
  }
  let w = targetWidth ?? Math.min(nw, DEFAULT_MAX_WIDTH)
  let h = targetHeight ?? Math.round((nh * w) / nw)
  if (targetWidth && !targetHeight) {
    h = Math.round((nh * w) / nw)
  } else if (!targetWidth && targetHeight) {
    w = Math.round((nw * h) / nh)
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return Promise.reject(new Error('No 2d context'))
  }
  ctx.drawImage(sourceImage, 0, 0, w, h)
  let imageData: ImageData
  try {
    imageData = ctx.getImageData(0, 0, w, h)
  } catch (e) {
    return Promise.reject(e)
  }

  const worker = getWorker()
  if (!worker) {
    const len = w * h * 4
    applyAdjustmentsToBuffer(imageData.data, len, params)
    ctx.putImageData(imageData, 0, 0)
    return canvasToBlobURL(canvas, mimeType, quality)
  }

  const len = w * h * 4
  const bufferCopy = imageData.data.slice(0).buffer
  const runId = ++workerRunId

  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ buffer: ArrayBuffer }>) => {
      if (runId !== workerRunId) return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      try {
        const { buffer } = e.data
        const result = new ImageData(new Uint8ClampedArray(buffer), w, h)
        ctx.putImageData(result, 0, 0)
        canvasToBlobURL(canvas, mimeType, quality).then(resolve, reject)
      } catch (err) {
        reject(err)
      }
    }
    const onError = () => {
      if (runId !== workerRunId) return
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      applyAdjustmentsToBuffer(imageData.data, len, params)
      ctx.putImageData(imageData, 0, 0)
      canvasToBlobURL(canvas, mimeType, quality).then(resolve, reject)
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage(
      { buffer: bufferCopy, width: w, height: h, params },
      { transfer: [bufferCopy] },
    )
  })
}

function canvasToBlobURL(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas toBlob failed'))
          return
        }
        resolve(URL.createObjectURL(blob))
      },
      mimeType,
      quality,
    )
  })
}
