import { useRef } from 'react'
import { createPortal } from 'react-dom'

type StandardMenuProps = {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onAction?: (action: string) => void
  options: string[][]
  ariaLabel?: string
}

function StandardMenu({ isOpen, anchorRect, onClose, onAction, options, ariaLabel = 'Menu' }: StandardMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  if (!isOpen || !anchorRect) return null

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
        className="thumbnail-more-menu"
        role="menu"
        aria-label={ariaLabel}
        style={{
          position: 'fixed',
          left: Math.max(8, Math.min(anchorRect.right - 200, window.innerWidth - 208)),
          top: anchorRect.bottom + 8,
          minWidth: 200,
        }}
      >
        {options.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && <div className="thumbnail-more-menu-separator" />}
            {group.map((label) => (
              <button
                key={label}
                type="button"
                className="thumbnail-more-menu-item"
                role="menuitem"
                onClick={() => {
                  onAction?.(label)
                  onClose()
                }}
              >
                {label}
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
