import { useContext, useRef, useState } from 'react'
import { TooltipContext } from '../contexts/TooltipContext'

const TOOLTIP_DELAY_MS = 2000

/**
 * Global tooltip button for the prototype. Use anywhere you need a button with a tooltip.
 * - Hover 2s to show tooltip; after that, tooltips appear immediately when moving between any TooltipButtons
 * - Tooltip mode exits 2s after leaving all tooltip buttons
 * @example
 * <TooltipButton tooltip="Save" shortcut="S" aria-label="Save" onClick={handleSave}>
 *   <img src={saveIcon} alt="" />
 * </TooltipButton>
 */
type TooltipButtonProps = {
  tooltip: string
  shortcut?: string
  children: React.ReactNode
  className?: string
  type?: 'button' | 'submit'
  'aria-label'?: string
  'aria-haspopup'?: boolean | 'dialog' | 'menu' | 'true' | 'false' | 'listbox' | 'tree' | 'grid'
  'aria-expanded'?: boolean
  'aria-selected'?: boolean
  'aria-pressed'?: boolean
  role?: string
  placement?: 'above' | 'below'
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void
}

function TooltipButton({
  tooltip,
  shortcut,
  children,
  className = '',
  type = 'button',
  'aria-label': ariaLabel,
  'aria-haspopup': ariaHaspopup,
  'aria-expanded': ariaExpanded,
  'aria-selected': ariaSelected,
  'aria-pressed': ariaPressed,
  role,
  placement = 'below',
  onClick,
}: TooltipButtonProps) {
  const context = useContext(TooltipContext)
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const tooltipModeActive = context?.tooltipModeActive ?? false
  const onTooltipShown = context ? () => context.setTooltipModeActive(true) : undefined
  const onEnter = context?.onTooltipButtonEnter
  const onLeave = context?.onTooltipButtonLeave

  const handleMouseEnter = () => {
    onEnter?.()
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    if (tooltipModeActive) {
      setIsTooltipVisible(true)
    } else {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsTooltipVisible(true)
        onTooltipShown?.()
      }, TOOLTIP_DELAY_MS)
    }
  }

  const handleMouseLeave = () => {
    onLeave?.()
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setIsTooltipVisible(false)
  }

  return (
    <div className="tooltip-button-wrap">
      <button
        type={type}
        className={className}
        role={role}
        aria-label={ariaLabel}
        aria-haspopup={ariaHaspopup}
        aria-expanded={ariaExpanded}
        aria-selected={ariaSelected}
        aria-pressed={ariaPressed}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </button>
      {isTooltipVisible && (
        <span className={`tooltip${placement === 'above' ? ' tooltip--above' : ''}`}>
          {tooltip}
          {shortcut != null && (
            <>
              {' '}
              <span className="tooltip-key">{shortcut}</span>
            </>
          )}
        </span>
      )}
    </div>
  )
}

export default TooltipButton
