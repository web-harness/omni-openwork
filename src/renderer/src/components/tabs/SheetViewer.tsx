import { useMemo } from "react"
import * as XLSX from "xlsx"
import { AlertCircle } from "lucide-react"

interface SheetViewerProps {
  base64Content: string
  filename: string
}

export function SheetViewer({ base64Content, filename }: SheetViewerProps): React.JSX.Element {
  const result = useMemo<{ html: string | null; error: string | null }>(() => {
    try {
      const binary = atob(base64Content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const wb = XLSX.read(bytes, { type: "array" })
      const ws = wb.Sheets[wb.SheetNames[0]]
      return { html: XLSX.utils.sheet_to_html(ws), error: null }
    } catch (e) {
      return { html: null, error: e instanceof Error ? e.message : "Failed to parse spreadsheet" }
    }
  }, [base64Content])

  if (result.error) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <AlertCircle className="size-5 text-status-critical" />
        {result.error}
      </div>
    )
  }

  if (!result.html) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Parsing {filename}...
      </div>
    )
  }

  return (
    <div
      className="flex-1 overflow-auto p-4 text-sm text-foreground [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted"
      dangerouslySetInnerHTML={{ __html: result.html }}
    />
  )
}
