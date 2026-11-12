// Where Echo's speech bubble goes (docs/tickets/JB01-mascot-dock.md). Pure: rectangles in, a place out.
// It prefers above and to the left of the helmet (the dock sits bottom right), flips to the side with room, and never leaves the viewport.

export type BubbleSide = 'above' | 'below' | 'left' | 'right'
export type BubblePlace = { x: number; y: number; side: BubbleSide }
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number }

/** The space between the helmet and the bubble's tail. */
export const BUBBLE_GAP = 12

/** A viewport smaller than the bubble pins it at the margin (the top-left corner stays visible). */
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(value, high))

export function placeBubble(
  anchor: Box,
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  margin = 16,
): BubblePlace {
  const { w, h } = size
  const centreY = anchor.top + anchor.height / 2
  const tries: { side: BubbleSide; x: number; y: number; fits: boolean }[] = [
    // Above, its right edge level with the helmet's, so it grows to the left.
    { side: 'above', x: anchor.right - w, y: anchor.top - BUBBLE_GAP - h, fits: anchor.top - BUBBLE_GAP - h >= margin },
    { side: 'below', x: anchor.right - w, y: anchor.bottom + BUBBLE_GAP, fits: anchor.bottom + BUBBLE_GAP + h <= viewport.h - margin },
    { side: 'left', x: anchor.left - BUBBLE_GAP - w, y: centreY - h / 2, fits: anchor.left - BUBBLE_GAP - w >= margin },
    { side: 'right', x: anchor.right + BUBBLE_GAP, y: centreY - h / 2, fits: anchor.right + BUBBLE_GAP + w <= viewport.w - margin },
  ]
  // When nothing fits, stay above and let the clamp pin it.
  const chosen = tries.find(t => t.fits) ?? tries[0]
  return {
    side: chosen.side,
    x: clamp(chosen.x, margin, viewport.w - margin - w),
    y: clamp(chosen.y, margin, viewport.h - margin - h),
  }
}
