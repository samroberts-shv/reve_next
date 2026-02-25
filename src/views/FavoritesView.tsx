type FavoritesViewProps = {
  fixedLastImageSrc: string
  placeholderImageSrcs: string[]
  resolveThumbnailSrc: (src: string) => string
  onOpenEditView: (imageSrc: string, tileIndex: number, imageAspectRatio?: number) => void
  showThumbnails: boolean
  isImageHidden?: boolean
}

const galleryTileMinSizePx = 200
const galleryTileMaxSizePx = 300
const galleryTileGapPx = 10
const galleryChatColumnWidthPx = 320

function FavoritesView({
  fixedLastImageSrc,
  placeholderImageSrcs,
  resolveThumbnailSrc,
  onOpenEditView,
  showThumbnails,
  isImageHidden = false,
}: FavoritesViewProps) {
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
    ...placeholderImageSrcs.map((src) => ({
      kind: 'image' as const,
      src,
    })),
    {
      kind: 'image' as const,
      src: fixedLastImageSrc,
    },
  ]

  return (
    <main className="gallery-view-stage">
      {showThumbnails && (
        <section
          className="gallery-grid"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, ${tileSize}px)` }}
          aria-label="Favorites thumbnails"
        >
          {favoriteTiles.map((tile, index) => (
            <button
              key={`image-${index}-${tile.src}`}
              className={`gallery-view-thumb-button${isImageHidden && index === favoriteTiles.length - 1 ? ' gallery-view-thumb-button--hidden' : ''}`}
              type="button"
              aria-label="Open image in edit view"
              onClick={(event) => {
                const thumbnailImage = event.currentTarget.querySelector('img')
                const imageAspectRatio =
                  thumbnailImage && thumbnailImage.naturalWidth > 0 && thumbnailImage.naturalHeight > 0
                    ? thumbnailImage.naturalWidth / thumbnailImage.naturalHeight
                    : undefined
                onOpenEditView(tile.src, index, imageAspectRatio)
              }}
            >
              <img
                className="gallery-view-thumb-image"
                src={resolveThumbnailSrc(tile.src)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </section>
      )}
      <aside className="gallery-chat-column" aria-label="Favorites chat column" />
    </main>
  )
}

export default FavoritesView
