import type React from "react"

type DockWrapperAttributes = React.HTMLAttributes<HTMLElement> & {
  direction?: string
  position?: string
  size?: string | number
  gap?: string | number
  padding?: string | number
  "max-range"?: string | number
  "max-scale"?: string | number
  disabled?: boolean
}

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      "dock-wrapper": React.DetailedHTMLProps<DockWrapperAttributes, HTMLElement>
      "dock-item": React.DetailedHTMLProps<DockWrapperAttributes, HTMLElement>
    }
  }
}

export {}
