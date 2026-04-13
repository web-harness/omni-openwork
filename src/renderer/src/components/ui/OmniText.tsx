import { useEffect, useRef, useState } from "react"
import { prepare, measureLineStats, measureNaturalWidth } from "@chenglou/pretext"

interface OmniTextProps {
  text: string
  strategy?: "truncate" | "shrink" | "shrink-truncate"
  maxLines?: number
  minSize?: number
  className?: string
  style?: React.CSSProperties
}

export function OmniText({
  text,
  strategy = "truncate",
  maxLines = 1,
  minSize = 10,
  className,
  style
}: OmniTextProps): React.JSX.Element {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [displayText, setDisplayText] = useState(text)
  const [fontSize, setFontSize] = useState<number | undefined>(undefined)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function measure(): void {
      if (!el) return
      const width = el.offsetWidth
      if (width === 0) return

      const computedStyle = window.getComputedStyle(el)
      const baseFontSize = parseFloat(computedStyle.fontSize)
      const fontStr = computedStyle.font

      if (strategy === "shrink" || strategy === "shrink-truncate") {
        let size = baseFontSize
        while (size > minSize) {
          const font = fontStr.replace(/[\d.]+px/, `${size}px`)
          const prepared = prepare(text, font)
          const stats = measureLineStats(prepared as Parameters<typeof measureLineStats>[0], width)
          if (stats.lineCount <= maxLines) break
          size -= 0.5
        }
        setFontSize(size)
        setDisplayText(text)
        return
      }

      // truncate strategy
      const prepared = prepare(text, fontStr)
      const naturalWidth = measureNaturalWidth(
        prepared as Parameters<typeof measureNaturalWidth>[0]
      )
      if (naturalWidth <= width * maxLines) {
        setDisplayText(text)
        return
      }

      // Binary search for truncation point
      let lo = 0
      let hi = text.length
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2)
        const truncated = text.slice(0, mid) + "…"
        const p = prepare(truncated, fontStr)
        const stats = measureLineStats(p as Parameters<typeof measureLineStats>[0], width)
        if (stats.lineCount <= maxLines) {
          lo = mid
        } else {
          hi = mid - 1
        }
      }
      setDisplayText(text.slice(0, lo) + (lo < text.length ? "…" : ""))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, strategy, maxLines, minSize])

  return (
    <span
      ref={containerRef}
      className={className}
      style={{
        ...style,
        fontSize: fontSize ? `${fontSize}px` : undefined,
        display: "block",
        overflow: "hidden",
        whiteSpace: maxLines === 1 ? "nowrap" : undefined
      }}
      title={text}
    >
      {displayText}
    </span>
  )
}
