import { createAvatar } from "@dicebear/core"
import * as botttsNeutral from "@dicebear/bottts-neutral"

const STYLE_MAP: Record<string, typeof botttsNeutral> = {
  "bottts-neutral": botttsNeutral
}

export function agentAvatarSvg(seed: string, styleName: string): string {
  const style = STYLE_MAP[styleName] ?? botttsNeutral
  return createAvatar(style, { seed }).toString()
}
