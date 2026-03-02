import StandardMenu from './StandardMenu'

type ThumbnailMoreMenuProps = {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onAction?: (action: string) => void
  isFavorited?: boolean
}

const THUMBNAIL_MORE_MENU_OPTIONS_BASE = [
  ['Open in new tab', 'Download image…', 'Copy image', 'Copy share link', 'Jump to message'],
  ['Create variations', 'Upscale', 'Remove background'],
  [
    'Add to album',
    'Add to reference',
    'Rename image..',
    'Favorite image', // replaced by 'Unfavorite image' when isFavorited
    'Flag image',
    'Delete image',
  ],
] as const

function ThumbnailMoreMenu({ isOpen, anchorRect, onClose, onAction, isFavorited = false }: ThumbnailMoreMenuProps) {
  const menuOptions = THUMBNAIL_MORE_MENU_OPTIONS_BASE.map((group, groupIndex) =>
    groupIndex === 2
      ? group.map((label) => (label === 'Favorite image' && isFavorited ? 'Unfavorite image' : label))
      : [...group],
  )

  return (
    <StandardMenu
      isOpen={isOpen}
      anchorRect={anchorRect}
      onClose={onClose}
      onAction={onAction}
      options={menuOptions}
      ariaLabel="Image options"
    />
  )
}

export default ThumbnailMoreMenu
