const ROW_GAP = 12
const ROW_PADDING_X = 32

export function computeRowMinWidth(widths: string[], flexFallbackPx = 180): number {
  let total = ROW_PADDING_X
  for (const w of widths) {
    total += w.endsWith('px') ? parseFloat(w) : flexFallbackPx
  }
  total += Math.max(0, widths.length - 1) * ROW_GAP
  return Math.ceil(total)
}
