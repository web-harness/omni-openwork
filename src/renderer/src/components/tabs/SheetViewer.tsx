import { useEffect, useState } from "react"
import * as XLSX from "xlsx"
import { Loader2, AlertCircle } from "lucide-react"

interface SheetViewerProps {
  base64Content: string
  filename: string
}

export function SheetViewer({ base64Content, filename }: SheetViewerProps): React.JSX.Element {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const binary = atob(base64Content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const wb = XLSX.read(bytes, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      setHtml(XLSX.utils.sheet_to_html(ws))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse spreadsheet")
    }
  }, [base64Content])

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="size-5 text-status-critical" />
        {error}
      </div>
    )
  }

  if (!html) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        Parsing {filename}...
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-auto p-4 text-sm text-foreground [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
