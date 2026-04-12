import { useEffect, useRef, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"

interface DocxViewerProps {
  base64Content: string
  filename: string
}

export function DocxViewer({ base64Content, filename }: DocxViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    setLoading(true)
    setError(null)

    import("docx-preview")
      .then(({ renderAsync }) => {
        const binary = atob(base64Content)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return renderAsync(bytes.buffer, container, undefined, {
          className: "docx-viewer"
        })
      })
      .then(() => setLoading(false))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to render document")
        setLoading(false)
      })
  }, [base64Content])

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      {loading && (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
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
      <div ref={containerRef} className="flex-1 p-4 bg-white text-black" />
    </div>
  )
}
