type FavoritesViewProps = {
  displayImageSrc: string
  placeholderColors: string[]
  onOpenEditView: (imageSrc: string, tileIndex: number) => void
  isImageHidden?: boolean
}

const galleryTileMinSizePx = 200
const galleryTileMaxSizePx = 300
const galleryTileGapPx = 10
const galleryChatColumnWidthPx = 320

function FavoritesView({ displayImageSrc, placeholderColors, onOpenEditView, isImageHidden = false }: FavoritesViewProps) {
  const availableWidth = Math.max(galleryTileMinSizePx, window.innerWidth - galleryChatColumnWidthPx - galleryTileGapPx * 2)
  const minimumColumnsForMaxSize = Math.max(
    1,
    Math.ceil((availableWidth + galleryTileGapPx) / (galleryTileMaxSizePx + galleryTileGapPx)),
  )
  const maximumColumnsForMinSize = Math.max(
    1,
    Math.floor((availableWidth + galleryTileGapPx) / (galleryTileMinSizePx + galleryTileGapPx)),
  )
  const gridColumns = Math.max(minimumColumnsForMaxSize, Math.min(maximumColumnsForMinSize, maximumColumnsForMinSize))
  const tileSize = Math.min(
    galleryTileMaxSizePx,
    Math.max(galleryTileMinSizePx, (availableWidth - (gridColumns - 1) * galleryTileGapPx) / gridColumns),
  )

  const favoriteTiles = [
    ...placeholderColors.map((color) => ({
      kind: 'color' as const,
      color,
    })),
    {
      kind: 'image' as const,
      src: displayImageSrc,
    },
  ]

  return (
    <main className="gallery-view-stage">
      <section
        className="gallery-grid"
        style={{ gridTemplateColumns: `repeat(${gridColumns}, ${tileSize}px)` }}
        aria-label="Favorites thumbnails"
      >
        {favoriteTiles.map((tile, index) => (
          <button
            key={tile.kind === 'color' ? `${tile.color}-${index}` : `image-${index}`}
            className={`gallery-view-thumb-button${isImageHidden && tile.kind === 'image' ? ' gallery-view-thumb-button--hidden' : ''}`}
            type="button"
            aria-label="Open image in edit view"
            onClick={() => {
              onOpenEditView(tile.kind === 'image' ? tile.src : displayImageSrc, index)
            }}
          >
            {tile.kind === 'image' ? (
              <img className="gallery-view-thumb-image" src={tile.src} alt="" aria-hidden="true" />
            ) : (
              <span className="gallery-view-color-tile" style={{ backgroundColor: tile.color }} aria-hidden="true" />
            )}
          </button>
        ))}
      </section>
      <aside className="gallery-chat-column" aria-label="Favorites chat column" />
    </main>
  )
}

export default FavoritesView
