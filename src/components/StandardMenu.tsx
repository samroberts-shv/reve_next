import { type CSSProperties, useRef } from 'react'
import { createPortal } from 'react-dom'
import chevronRightGlyph from '../assets/glyphs/chevron_right.svg'
import checkGlyph from '../assets/glyphs/check.svg'

type StandardMenuProps = {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onAction?: (action: string) => void
  options: string[][]
  ariaLabel?: string
  placement?: 'below' | 'above'
  statusValues?: Record<string, string>
  showChevron?: boolean
  checkedOption?: string
  minWidth?: number
}

function StandardMenu({ isOpen, anchorRect, onClose, onAction, options, ariaLabel = 'Menu', placement = 'below', statusValues, showChevron, checkedOption, minWidth = 200 }: StandardMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  if (!isOpen || !anchorRect) return null

  const menuStyle: CSSProperties = {
    position: 'fixed',
    left: Math.max(8, Math.min(anchorRect.right - minWidth, window.innerWidth - minWidth - 8)),
    width: minWidth,
    minWidth,
  }
  if (placement === 'above') {
    menuStyle.bottom = window.innerHeight - anchorRect.top + 8
  } else {
    menuStyle.top = anchorRect.bottom + 8
  }

  const content = (
    <>
      <div
        className="thumbnail-more-menu-backdrop"
        aria-hidden="true"
        onClick={onClose}
        onPointerDown={(e) => e.preventDefault()}
      />
      <div
        ref={menuRef}
        className={`thumbnail-more-menu${statusValues || showChevron || checkedOption != null ? ' thumbnail-more-menu--with-status' : ''}${checkedOption != null ? ' thumbnail-more-menu--with-check' : ''}`}
        role="menu"
        aria-label={ariaLabel}
        style={menuStyle}
      >
        {options.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && <div className="thumbnail-more-menu-separator" />}
            {group.map((label) => (
              <button
                key={label}
                type="button"
                className={`thumbnail-more-menu-item${checkedOption != null ? ' thumbnail-more-menu-item--sub' : ''}`}
                role={checkedOption != null ? 'menuitemradio' : 'menuitem'}
                aria-checked={checkedOption === label}
                onClick={() => {
                  onAction?.(label)
                  onClose()
                }}
              >
                {checkedOption != null && (
                  checkedOption === label ? (
                    <img className="thumbnail-more-menu-item-check" src={checkGlyph} alt="" aria-hidden="true" />
                  ) : (
                    <span className="thumbnail-more-menu-item-check-placeholder" />
                  )
                )}
                <span>{label}</span>
                {statusValues?.[label] != null && statusValues[label] !== '' && (
                  <span className="thumbnail-more-menu-item-status">{statusValues[label]}</span>
                )}
                {showChevron && (
                  <img className="thumbnail-more-menu-item-chevron" src={chevronRightGlyph} alt="" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )

  return createPortal(content, document.body)
}

export default StandardMenu
