import { useState, useEffect } from "react"
import { ChevronDown, Check, Key, Bot } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { useAppStore } from "@/lib/store"
import { useCurrentThread } from "@/lib/thread-context"
import { cn } from "@/lib/utils"
import { ApiKeyDialog } from "./ApiKeyDialog"
import type { Provider } from "@/types"

function OpenAIIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

interface ModelSwitcherProps {
  threadId: string
}

export function ModelSwitcher({ threadId }: ModelSwitcherProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [apiKeyProvider, setApiKeyProvider] = useState<Provider | null>(null)

  const { models, providers, loadModels, loadProviders, activeAgentId, agentEndpoints } =
    useAppStore()
  const { currentModel, setCurrentModel } = useCurrentThread(threadId)

  useEffect(() => {
    loadModels()
    loadProviders()
  }, [loadModels, loadProviders])

  const activeAgent = activeAgentId ? agentEndpoints.find((e) => e.id === activeAgentId) : null

  const selectedModel = models.find((m) => m.id === currentModel)
  const openaiProvider = providers.find((p) => p.id === "openai")
  const openaiModels = models.filter((m) => m.provider === "openai")

  function handleModelSelect(modelId: string): void {
    setCurrentModel(modelId)
    setOpen(false)
  }

  function handleConfigureApiKey(): void {
    const provider = providers.find((p) => p.id === "openai")
    if (provider) {
      setApiKeyProvider(provider)
      setApiKeyDialogOpen(true)
    }
  }

  function handleApiKeyDialogClose(isOpen: boolean): void {
    setApiKeyDialogOpen(isOpen)
    if (!isOpen) {
      loadProviders()
      loadModels()
    }
  }

  if (activeAgent) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-2 text-xs text-muted-foreground cursor-default"
        disabled
      >
        <Bot className="size-3.5" />
        <span className="font-mono">{activeAgent.name}</span>
      </Button>
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {selectedModel ? (
              <>
                <OpenAIIcon className="size-3.5" />
                <span className="font-mono">{selectedModel.id}</span>
              </>
            ) : (
              <span>Select model</span>
            )}
            <ChevronDown className="size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-2 bg-background border-border"
          align="start"
          sideOffset={8}
        >
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">
            OpenAI Models
          </div>

          {openaiProvider && !openaiProvider.hasApiKey ? (
            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
              <Key className="size-6 text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground mb-3">API key required for OpenAI</p>
              <Button size="sm" onClick={handleConfigureApiKey}>
                Configure API Key
              </Button>
            </div>
          ) : (
            <div className="flex flex-col max-h-[280px]">
              <div className="overflow-y-auto flex-1 space-y-0.5">
                {openaiModels.map((model) => (
                  <button
                    type="button"
                    key={model.id}
                    onClick={() => handleModelSelect(model.id)}
                    className={cn(
                      "w-full flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs transition-colors text-left font-mono",
                      currentModel === model.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="flex-1 truncate">{model.id}</span>
                    {currentModel === model.id && (
                      <Check className="size-3.5 shrink-0 text-foreground" />
                    )}
                  </button>
                ))}

                {openaiModels.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-4">No models available</p>
                )}
              </div>

              {openaiProvider?.hasApiKey && (
                <button
                  type="button"
                  onClick={handleConfigureApiKey}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors mt-2 border-t border-border pt-2"
                >
                  <Key className="size-3.5" />
                  <span>Edit API Key</span>
                </button>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      <ApiKeyDialog
        open={apiKeyDialogOpen}
        onOpenChange={handleApiKeyDialogClose}
        provider={apiKeyProvider}
      />
    </>
  )
}
