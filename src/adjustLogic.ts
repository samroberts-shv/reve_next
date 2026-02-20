/**
 * Pure adjustment math shared by main thread and worker.
 * Operates on a RGBA buffer (Uint8ClampedArray or ImageData.data).
 */
import type { AdjustParams } from './adjustParams'

const LUM_R = 0.299
const LUM_G = 0.587
const LUM_B = 0.114

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)))
}

function luminance(r: number, g: number, b: number): number {
  return LUM_R * r + LUM_G * g + LUM_B * b
}

/** Apply all adjustments in pipeline order. Modifies d in place. len = width * height * 4. */
export function applyAdjustmentsToBuffer(
  d: Uint8ClampedArray,
  len: number,
  p: AdjustParams,
): void {
  const expFactor = 2 ** p.exposure
  const cp = p.contrast
  const highAmount = p.highlights * 0.4
  const shadowAmount = p.shadows * 0.4
  const temp = p.temp * 0.2
  const tint = p.tint * 0.2

  for (let i = 0; i < len; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]

    r = r * expFactor
    g = g * expFactor
    b = b * expFactor

    let rn = r / 255
    let gn = g / 255
    let bn = b / 255

    rn = (rn - 0.5) * cp + 0.5
    gn = (gn - 0.5) * cp + 0.5
    bn = (bn - 0.5) * cp + 0.5

    const L = luminance(rn, gn, bn)
    const tHigh = Math.max(0, (L - 0.5) * 2)
    const highLift = 1 + highAmount * (1 - tHigh)
    rn *= highLift
    gn *= highLift
    bn *= highLift

    const tLow = Math.max(0, (0.5 - L) * 2)
    const shadowLift = 1 + shadowAmount * (1 - tLow)
    rn *= shadowLift
    gn *= shadowLift
    bn *= shadowLift

    rn += temp
    bn -= temp
    gn -= tint

    const L2 = luminance(rn, gn, bn)
    rn = L2 + (rn - L2) * p.saturation
    gn = L2 + (gn - L2) * p.saturation
    bn = L2 + (bn - L2) * p.saturation

    const sat = Math.max(
      Math.abs(rn - L2),
      Math.abs(gn - L2),
      Math.abs(bn - L2),
    )
    const vib = 1 + (p.vibrance - 1) * (1 - sat)
    rn = L2 + (rn - L2) * vib
    gn = L2 + (gn - L2) * vib
    bn = L2 + (bn - L2) * vib

    d[i] = clamp255(rn * 255)
    d[i + 1] = clamp255(gn * 255)
    d[i + 2] = clamp255(bn * 255)
  }
}
