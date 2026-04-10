import { useState } from "react"
import "dockbar"
import { Brain, Plus, Trash2 } from "lucide-react"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { AgentEndpoint } from "@/types"
import { agentAvatarSvg } from "@/lib/agentAvatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function agentInitials(name: string): string {
  const initials = name
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  if (initials.length > 0) return initials
  return (
    name
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "AG"
  )
}

interface AgentItemProps {
  endpoint: AgentEndpoint
  isActive: boolean
  isDimmed: boolean
  dicebearStyle: string
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onDelete: () => void
}

function AgentItem({
  endpoint,
  isActive,
  isDimmed,
  dicebearStyle,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDelete
}: AgentItemProps): React.JSX.Element {
  const initials = agentInitials(endpoint.name)
  const svgDataUri = endpoint.removable
    ? `data:image/svg+xml;utf8,${encodeURIComponent(agentAvatarSvg(endpoint.id, dicebearStyle))}`
    : null

  return (
    <dock-item size={36} gap={6}>
      <div
        className="dock-btn-wrap group/item"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {endpoint.removable && (
          <button
            type="button"
            title={`Remove ${endpoint.name}`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className={cn(
              "absolute -right-1 -top-1 z-20",
              "flex h-4 w-4 items-center justify-center rounded-full",
              "bg-background-interactive border border-border",
              "text-muted-foreground opacity-0 transition-opacity duration-100",
              "hover:bg-status-critical hover:text-foreground hover:border-status-critical",
              "group-hover/item:opacity-100"
            )}
          >
            <Trash2 size={8} />
          </button>
        )}

        <button
          type="button"
          title={endpoint.name}
          onClick={onClick}
          className={cn(
            "relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border transition-all duration-150",
            isActive
              ? "border-primary bg-background-interactive ring-2 ring-primary/80"
              : "border-border bg-background-interactive hover:border-primary/50 hover:bg-background-interactive/80",
            isDimmed ? "opacity-40" : "opacity-100"
          )}
        >
          {endpoint.removable ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-status-info/25 via-primary/15 to-background-elevated text-[11px] font-semibold text-foreground">
                {initials}
              </div>
              {svgDataUri && (
                <img
                  className="relative z-10 block h-full w-full object-cover"
                  src={svgDataUri}
                  alt={endpoint.name}
                />
              )}
            </>
          ) : (
            <Brain className="text-primary" size={20} />
          )}
        </button>
      </div>
    </dock-item>
  )
}

const EMPTY_FORM = { name: "", url: "", bearerToken: "" }

function AddAgentDockItem(): React.JSX.Element {
  const { upsertAgentEndpoint, setActiveAgentId } = useAppStore()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  function handleChange(field: keyof typeof EMPTY_FORM, value: string): void {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault()
    const name = form.name.trim()
    const url = form.url.trim()

    if (!name) {
      setError("Agent name is required.")
      return
    }
    if (!url) {
      setError("Agent URL is required.")
      return
    }

    try {
      const parsed = new URL(url)
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setError("Agent URL must use http or https.")
        return
      }
    } catch {
      setError("Agent URL must be a valid URL (e.g. http://localhost:8080).")
      return
    }

    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    upsertAgentEndpoint({ id, name, url, bearerToken: form.bearerToken.trim(), removable: true })
    setActiveAgentId(id)
    setForm(EMPTY_FORM)
    setError(null)
    setOpen(false)
  }

  function handleOpenChange(next: boolean): void {
    setOpen(next)
    if (!next) {
      setForm(EMPTY_FORM)
      setError(null)
    }
  }

  return (
    <dock-item size={36} gap={6}>
      <div className="dock-btn-wrap">
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Add agent"
              className={cn(
                "flex h-full w-full items-center justify-center rounded-lg border border-dashed",
                "border-border bg-background-interactive text-muted-foreground transition-colors",
                "hover:border-primary/60 hover:text-primary"
              )}
            >
              <Plus size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72 p-0 bg-background border-border"
            side="right"
            align="start"
            sideOffset={10}
          >
            <form onSubmit={handleSubmit}>
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Add Agent
                </div>
              </div>

              <div className="space-y-3 p-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input
                    autoFocus
                    placeholder="My Agent"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Agent URL</label>
                  <Input
                    placeholder="http://localhost:8080"
                    value={form.url}
                    onChange={(e) => handleChange("url", e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Bearer Token{" "}
                    <span className="text-[10px] text-muted-foreground/60">(optional)</span>
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={form.bearerToken}
                    onChange={(e) => handleChange("bearerToken", e.target.value)}
                  />
                </div>

                {error && <p className="text-xs text-status-critical">{error}</p>}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="h-7 px-3 text-xs">
                  Add Agent
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </dock-item>
  )
}

export function AgentRail(): React.JSX.Element {
  const {
    orderedAgentEndpoints,
    activeAgentId,
    dicebearStyle,
    setActiveAgentId,
    removeAgentEndpoint
  } = useAppStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dockHovered, setDockHovered] = useState(false)

  const endpoints = orderedAgentEndpoints()

  return (
    <div
      className="agent-rail flex h-full flex-col items-center"
      style={{ width: 48, flexShrink: 0, overflow: dockHovered ? "visible" : "hidden" }}
      onMouseEnter={() => setDockHovered(true)}
      onMouseLeave={() => setDockHovered(false)}
    >
      <dock-wrapper
        direction="vertical"
        position="left"
        size="36"
        gap="6"
        padding="6"
        max-range="150"
        max-scale="1.8"
        style={{ display: "block", height: "100%", width: "100%" }}
      >
        {endpoints.map((endpoint) => {
          const isActive = endpoint.removable
            ? activeAgentId === endpoint.id
            : activeAgentId === null
          const isDimmed = hoveredId !== null && hoveredId !== endpoint.id

          return (
            <AgentItem
              key={endpoint.id}
              endpoint={endpoint}
              isActive={isActive}
              isDimmed={isDimmed}
              dicebearStyle={dicebearStyle}
              onMouseEnter={() => setHoveredId(endpoint.id)}
              onMouseLeave={() => setHoveredId((prev) => (prev === endpoint.id ? null : prev))}
              onClick={() => {
                if (endpoint.removable) {
                  setActiveAgentId(endpoint.id)
                } else {
                  setActiveAgentId(null)
                }
              }}
              onDelete={() => removeAgentEndpoint(endpoint.id)}
            />
          )
        })}

        <AddAgentDockItem />
      </dock-wrapper>
    </div>
  )
}
