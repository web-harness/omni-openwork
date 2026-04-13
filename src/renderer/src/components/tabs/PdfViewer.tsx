import { useEffect, useRef } from "react"

interface PdfViewerProps {
  base64Content: string
  filename: string
}

export function PdfViewer({ base64Content }: PdfViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let cancelled = false

    async function render(): Promise<void> {
      const pdfjsLib = await import("pdfjs-dist")
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).href

      const binary = atob(base64Content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      if (cancelled || !container) return

      container.innerHTML = ""

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (cancelled) return
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement("canvas")
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.display = "block"
        canvas.style.marginBottom = "8px"
        canvas.style.maxWidth = "100%"
        await page.render({ canvas, viewport }).promise
        if (cancelled || !container) return
        container.appendChild(canvas)
      }
    }

    render()
    return () => {
      cancelled = true
    }
  }, [base64Content])

  return (
    <div className="flex-1 overflow-auto p-4 bg-muted/30">
      <div ref={containerRef} className="flex flex-col items-center" />
    </div>
  )
}
