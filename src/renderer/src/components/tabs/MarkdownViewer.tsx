import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"

interface MarkdownViewerProps {
  value: string
}

export function MarkdownViewer({ value }: MarkdownViewerProps): React.JSX.Element {
  const html = useMemo(() => {
    const raw = marked.parse(value, { async: false }) as string
    return DOMPurify.sanitize(raw)
  }, [value])

  return (
    <div
      className="prose prose-sm max-w-none p-4 overflow-auto flex-1 text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
