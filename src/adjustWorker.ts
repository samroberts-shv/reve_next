/**
 * Web Worker: runs adjustment math on pixel buffer so main thread stays responsive.
 */
import type { AdjustParams } from './adjustParams'
import { applyAdjustmentsToBuffer } from './adjustLogic'

export type WorkerInput = {
  buffer: ArrayBuffer
  width: number
  height: number
  params: AdjustParams
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { buffer, width, height, params } = e.data
  const len = width * height * 4
  const d = new Uint8ClampedArray(buffer)
  applyAdjustmentsToBuffer(d, len, params)
  self.postMessage({ buffer }, { transfer: [buffer] })
}
