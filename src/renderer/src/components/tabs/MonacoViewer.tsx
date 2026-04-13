import { useEffect, useRef } from "react"

interface MonacoViewerProps {
  value: string
  language?: string
  readOnly?: boolean
  theme?: string
}

export function MonacoViewer({
  value,
  language = "plaintext",
  readOnly = true,
  theme = "vs-dark"
}: MonacoViewerProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<unknown>(null)
  const languageRef = useRef(language)
  const readOnlyRef = useRef(readOnly)
  const themeRef = useRef(theme)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current
    let editor: { dispose(): void; getValue(): string; setValue(value: string): void } | null = null

    import("monaco-editor").then((monaco) => {
      if (!container.isConnected) return
      editor = monaco.editor.create(container, {
        value: valueRef.current,
        language: languageRef.current,
        readOnly: readOnlyRef.current,
        theme: themeRef.current,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontSize: 13,
        lineNumbers: "on",
        wordWrap: "on"
      })
      editorRef.current = editor
    })

    return () => {
      editor?.dispose()
    }
  }, [])

  useEffect(() => {
    const editor = editorRef.current as {
      dispose(): void
      getValue(): string
      setValue(value: string): void
    } | null
    if (editor && editor.getValue() !== value) {
      editor.setValue(value)
    }
  }, [value])

  return <div ref={containerRef} className="flex-1 min-h-0" style={{ height: "100%" }} />
}
