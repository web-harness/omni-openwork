import type React from "react"

type DockWrapperAttributes = React.HTMLAttributes<HTMLElement> & {
  direction?: string
  position?: string
  size?: string
  gap?: string
  padding?: string
  "max-range"?: string
  "max-scale"?: string
  disabled?: boolean
}

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      "dock-wrapper": React.DetailedHTMLProps<DockWrapperAttributes, HTMLElement>
      "dock-item": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
    }
  }
}

export {}
