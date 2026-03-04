import { createContext, useCallback, useRef, useState, type ReactNode } from 'react'

const TOOLTIP_EXIT_DELAY_MS = 2000

type TooltipContextValue = {
  tooltipModeActive: boolean
  setTooltipModeActive: (active: boolean) => void
  onTooltipButtonEnter: () => void
  onTooltipButtonLeave: () => void
}

export const TooltipContext = createContext<TooltipContextValue | null>(null)

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tooltipModeActive, setTooltipModeActive] = useState(false)
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onTooltipButtonEnter = useCallback(() => {
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current)
      exitTimeoutRef.current = null
    }
  }, [])

  const onTooltipButtonLeave = useCallback(() => {
    exitTimeoutRef.current = setTimeout(() => {
      setTooltipModeActive(false)
      exitTimeoutRef.current = null
    }, TOOLTIP_EXIT_DELAY_MS)
  }, [])

  const value: TooltipContextValue = {
    tooltipModeActive,
    setTooltipModeActive,
    onTooltipButtonEnter,
    onTooltipButtonLeave,
  }

  return <TooltipContext.Provider value={value}>{children}</TooltipContext.Provider>
}
