import { useRef } from 'react'
import { createPortal } from 'react-dom'

type ThumbnailMoreMenuProps = {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onAction?: (action: string) => void
}

const THUMBNAIL_MORE_MENU_OPTIONS = [
  ['Open in new tab', 'Download image…', 'Copy image', 'Copy share link', 'Jump to message'],
  ['Create variations', 'Upscale', 'Remove background'],
  [
    'Add to album',
    'Add to reference',
    'Rename image..',
    'Favorite image',
    'Flag image',
    'Delete image',
  ],
] as const

function ThumbnailMoreMenu({ isOpen, anchorRect, onClose, onAction }: ThumbnailMoreMenuProps) {
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
        aria-label="Image options"
        style={{
          position: 'fixed',
          left: Math.max(8, Math.min(anchorRect.right - 200, window.innerWidth - 208)),
          top: anchorRect.bottom + 8,
          minWidth: 200,
        }}
    >
      {THUMBNAIL_MORE_MENU_OPTIONS.map((group, groupIndex) => (
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

export default ThumbnailMoreMenu
