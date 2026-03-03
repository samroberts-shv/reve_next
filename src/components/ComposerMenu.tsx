import { type CSSProperties, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import chevronRightGlyph from '../assets/glyphs/chevron_right.svg'
import chevronBackGlyph from '../assets/glyphs/chevron_back.svg'
import checkGlyph from '../assets/glyphs/check.svg'

const COMPOSER_MENU_ITEMS = ['Tool', 'Count', 'Aspect Ratio', 'Use attachments', 'Model'] as const

const SUB_MENU_OPTIONS: Record<string, string[]> = {
  Tool: ['Auto', '1.5 Preview', 'Video from frames', 'Video from references', 'Video from prompt'],
  Count: ['Auto', '1 Image', '2 Images', '4 Images', '8 Images'],
  'Aspect Ratio': ['Auto', '16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16'],
  'Use attachments': ['Literally', 'As Inspiration'],
  Model: ['Default', 'Fast'],
}

export type ComposerMenuValues = {
  Tool: string
  Count: string
  'Aspect Ratio': string
  'Use attachments': string
  Model: string
}

const DEFAULT_VALUES: ComposerMenuValues = {
  Tool: 'Auto',
  Count: 'Auto',
  'Aspect Ratio': 'Auto',
  'Use attachments': 'Literally',
  Model: 'Default',
}

type ComposerMenuProps = {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  values: ComposerMenuValues
  onValuesChange: (values: ComposerMenuValues) => void
  placement?: 'below' | 'above'
  minWidth?: number
}

function ComposerMenu({
  isOpen,
  anchorRect,
  onClose,
  values,
  onValuesChange,
  placement = 'below',
  minWidth = 240,
}: ComposerMenuProps) {
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) setActiveSubMenu(null)
  }, [isOpen])

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

  const handleOptionSelect = (menuKey: string, option: string) => {
    onValuesChange({ ...values, [menuKey]: option })
    setActiveSubMenu(null)
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
        className="thumbnail-more-menu thumbnail-more-menu--with-status thumbnail-more-menu--composer"
        role="menu"
        aria-label={activeSubMenu ? `${activeSubMenu} options` : 'Composer options'}
        style={menuStyle}
      >
        {activeSubMenu === null ? (
          <>
            {COMPOSER_MENU_ITEMS.map((label) => (
              <button
                key={label}
                type="button"
                className="thumbnail-more-menu-item"
                role="menuitem"
                onClick={() => setActiveSubMenu(label)}
              >
                {label}
                <span className="thumbnail-more-menu-item-status">{values[label]}</span>
                <img className="thumbnail-more-menu-item-chevron" src={chevronRightGlyph} alt="" aria-hidden="true" />
              </button>
            ))}
          </>
        ) : (
          <>
            <div className="thumbnail-more-menu-header">
              <button
                type="button"
                className="thumbnail-more-menu-back-button"
                aria-label="Back"
                onClick={() => setActiveSubMenu(null)}
              >
                <img src={chevronBackGlyph} alt="" aria-hidden="true" />
              </button>
              <span className="thumbnail-more-menu-header-title">{activeSubMenu}</span>
            </div>
            <div className="thumbnail-more-menu-separator" />
            {SUB_MENU_OPTIONS[activeSubMenu]?.map((option) => (
              <button
                key={option}
                type="button"
                className="thumbnail-more-menu-item thumbnail-more-menu-item--sub"
                role="menuitemradio"
                aria-checked={values[activeSubMenu as keyof ComposerMenuValues] === option}
                onClick={() => handleOptionSelect(activeSubMenu, option)}
              >
                {values[activeSubMenu as keyof ComposerMenuValues] === option ? (
                  <img className="thumbnail-more-menu-item-check" src={checkGlyph} alt="" aria-hidden="true" />
                ) : (
                  <span className="thumbnail-more-menu-item-check-placeholder" />
                )}
                <span>{option}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </>
  )

  return createPortal(content, document.body)
}

export { DEFAULT_VALUES }
export default ComposerMenu
