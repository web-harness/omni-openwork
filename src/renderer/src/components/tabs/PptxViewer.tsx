import { useEffect, useRef, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"

interface PptxViewerProps {
  base64Content: string
  filename: string
}

export function PptxViewer({ base64Content, filename }: PptxViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    const binary = atob(base64Content)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    import("@aiden0z/pptx-renderer")
      .then(async ({ PptxViewer: Viewer }) => {
        if (cancelled) return
        await Viewer.open(bytes.buffer, container, { renderMode: "list" })
        if (!cancelled) setLoading(false)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to render presentation")
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
      container.innerHTML = ""
    }
  }, [base64Content])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-10">
          <Loader2 className="size-5 animate-spin mr-2" />
          Rendering {filename}...
        </div>
      )}
      {error && (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <AlertCircle className="size-5 text-status-critical" />
          {error}
        </div>
      )}
      <div ref={containerRef} className="flex-1 overflow-auto" />
    </div>
  )
}
