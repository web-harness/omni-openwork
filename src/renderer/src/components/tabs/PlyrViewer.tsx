import { useEffect, useRef } from "react"
import "plyr/dist/plyr.css"
import type Plyr from "plyr"

interface PlyrViewerProps {
  sourceUrl: string
  type: "video" | "audio"
  mimeType?: string
}

export function PlyrViewer({ sourceUrl, type, mimeType }: PlyrViewerProps): React.JSX.Element {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  const playerRef = useRef<Plyr | null>(null)

  useEffect(() => {
    if (!mediaRef.current) return

    import("plyr").then(({ default: PlyrClass }) => {
      playerRef.current = new PlyrClass(mediaRef.current!, {
        controls: ["play", "progress", "current-time", "mute", "volume", "fullscreen"]
      })
    })

    return () => {
      playerRef.current?.destroy()
    }
  }, [])

  const source = <source src={sourceUrl} type={mimeType} />

  if (type === "video") {
    return (
      <div className="flex flex-1 items-center justify-center bg-black p-4">
        <video ref={mediaRef as React.RefObject<HTMLVideoElement>} playsInline>
          {source}
        </video>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <audio ref={mediaRef as React.RefObject<HTMLAudioElement>}>{source}</audio>
    </div>
  )
}
