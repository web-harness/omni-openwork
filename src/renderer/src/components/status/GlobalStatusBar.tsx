import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"

const phaseColor: Record<string, string> = {
  idle: "text-muted-foreground",
  downloading: "text-[hsl(var(--color-info))]",
  loading: "text-[hsl(var(--color-info))]",
  ready: "text-[hsl(var(--color-nominal))]",
  busy: "text-[hsl(var(--color-warning))]",
  error: "text-[hsl(var(--color-critical))]",
  unsupported: "text-muted-foreground"
}

const phaseDot: Record<string, string> = {
  idle: "bg-muted-foreground",
  downloading: "bg-[hsl(var(--color-info))] animate-pulse",
  loading: "bg-[hsl(var(--color-info))] animate-pulse",
  ready: "bg-[hsl(var(--color-nominal))]",
  busy: "bg-[hsl(var(--color-warning))] animate-pulse",
  error: "bg-[hsl(var(--color-critical))]",
  unsupported: "bg-muted-foreground"
}

export function GlobalStatusBar(): React.JSX.Element {
  const { webllmPhase, webllmProgress, webllmStatusText, webllmErrorText } = useAppStore()

  const color = phaseColor[webllmPhase] ?? "text-muted-foreground"
  const dot = phaseDot[webllmPhase] ?? "bg-muted-foreground"

  const showProgress =
    (webllmPhase === "downloading" || webllmPhase === "loading") && webllmProgress > 0

  return (
    <div className="flex h-6 w-full shrink-0 items-center gap-3 border-t border-border bg-sidebar px-3 font-mono text-[10px] tracking-widest">
      {/* Hermes indicator */}
      <div className={cn("flex items-center gap-1.5", color)}>
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dot)} />
        <span className="uppercase opacity-60">HERMES</span>
        <span className="opacity-80">
          {webllmPhase === "idle" && "idle"}
          {webllmPhase === "downloading" &&
            `downloading${showProgress ? ` ${webllmProgress}%` : ""}`}
          {webllmPhase === "loading" && `loading${showProgress ? ` ${webllmProgress}%` : ""}`}
          {webllmPhase === "ready" && "ready"}
          {webllmPhase === "busy" && "processing"}
          {webllmPhase === "error" && (webllmErrorText ?? webllmStatusText ?? "error")}
          {webllmPhase === "unsupported" && "webgpu unavailable"}
        </span>
      </div>

      {/* Progress bar for download/load */}
      {showProgress && (
        <div className="flex items-center gap-1.5 flex-1 min-w-0 max-w-40">
          <div className="flex-1 h-[2px] rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all bg-[hsl(var(--color-info))]"
              style={{ width: `${webllmProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status text (truncated) for non-error phases */}
      {webllmPhase !== "error" && webllmStatusText && webllmPhase !== "ready" && (
        <span className="text-muted-foreground opacity-50 truncate max-w-xs hidden sm:inline">
          {webllmStatusText}
        </span>
      )}
    </div>
  )
}
