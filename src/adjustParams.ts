/**
 * Normalizes adjust slider values (-100..100) to pipeline-friendly units.
 * Single source of truth for mapping UI to image processing math.
 */
export interface AdjustParams {
  exposure: number   // EV; factor = 2^exposure
  contrast: number  // multiplier; 1 = no change
  highlights: number  // -1..1 amount
  shadows: number   // -1..1 amount
  temp: number     // -1..1 warm/cool
  tint: number     // -1..1 green/magenta
  vibrance: number // 0..2 multiplier on low-sat colors
  saturation: number // 0..2; 1 = unchanged
}

const SLIDER_MAX = 100

/** Map slider -100..100 to a range [min, max], with 0 -> mid. */
function range(slider: number, min: number, mid: number, max: number): number {
  if (slider <= 0) return mid + (mid - min) * (slider / SLIDER_MAX)
  return mid + (max - mid) * (slider / SLIDER_MAX)
}

export function normalizeAdjustParams(sliderValues: Record<string, number>): AdjustParams {
  const get = (id: string) => sliderValues[id] ?? 0
  return {
    exposure: range(get('Exposure'), -2, 0, 2),
    contrast: range(get('Contrast'), 0.5, 1, 2),
    highlights: get('Highlights') / SLIDER_MAX,
    shadows: get('Shadows') / SLIDER_MAX,
    temp: get('Temp') / SLIDER_MAX,
    tint: get('Tint') / SLIDER_MAX,
    vibrance: range(get('Vibrance'), 0, 1, 2),
    saturation: range(get('Saturation'), 0, 1, 2),
  }
}

/** Returns true if all sliders are at 0 (no adjustment needed). */
export function hasNoAdjustments(sliderValues: Record<string, number>): boolean {
  const ids = ['Temp', 'Tint', 'Exposure', 'Contrast', 'Highlights', 'Shadows', 'Vibrance', 'Saturation']
  return ids.every((id) => (sliderValues[id] ?? 0) === 0)
}
