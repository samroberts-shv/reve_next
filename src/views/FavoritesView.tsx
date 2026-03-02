import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import moreGlyph from '../assets/glyphs/more.svg'
import ThumbnailMoreMenu from '../components/ThumbnailMoreMenu'

type FavoritesViewProps = {
  favoritedImageSrcs: string[]
  setFavoritedImageSrcs: Dispatch<SetStateAction<string[]>>
  resolveThumbnailSrc: (src: string) => string
  resolveImageName: (src: string, index?: number) => string
  resolveImageDate: (src: string, index?: number) => string
  onOpenEditView: (
    imageSrc: string,
    tileIndex: number,
    imageAspectRatio?: number,
    fromRect?: { left: number; top: number; width: number; height: number },
  ) => void
  showThumbnails: boolean
  isImageHidden?: boolean
}

const galleryTileMinSizePx = 200
const galleryTileMaxSizePx = 300
const galleryTileGapPx = 10
const galleryChatColumnWidthPx = 320

function FavoritesView({
  favoritedImageSrcs,
  setFavoritedImageSrcs,
  resolveThumbnailSrc,
  resolveImageName,
  resolveImageDate,
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

  const favoriteTiles = favoritedImageSrcs.map((src) => ({
    kind: 'image' as const,
    src,
  }))
  const [openMoreMenuIndex, setOpenMoreMenuIndex] = useState<number | null>(null)
  const [moreMenuAnchorRect, setMoreMenuAnchorRect] = useState<DOMRect | null>(null)

  return (
    <main className="gallery-view-stage">
      {showThumbnails && favoriteTiles.length > 0 && (
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
                const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                onOpenEditView(tile.src, index, imageAspectRatio, rect)
              }}
            >
              <span
                className="gallery-view-thumb-more"
                role="button"
                tabIndex={0}
                aria-label="More options"
                aria-haspopup="menu"
                aria-expanded={openMoreMenuIndex === index}
                onClick={(e) => {
                  e.stopPropagation()
                  if (openMoreMenuIndex === index) {
                    setOpenMoreMenuIndex(null)
                    setMoreMenuAnchorRect(null)
                  } else {
                    setOpenMoreMenuIndex(index)
                    setMoreMenuAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
              >
                <img src={moreGlyph} alt="" aria-hidden="true" />
              </span>
              <img
                className="gallery-view-thumb-image"
                src={resolveThumbnailSrc(tile.src)}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
              />
              <span className="gallery-view-thumb-caption">
                {resolveImageDate(tile.src, index) && (
                  <span className="gallery-view-thumb-date">{resolveImageDate(tile.src, index)}</span>
                )}
                <span className="gallery-view-thumb-name">{resolveImageName(tile.src, index)}</span>
              </span>
            </button>
          ))}
        </section>
      )}
      {showThumbnails && favoriteTiles.length === 0 && (
        <p className="favorites-empty-message" aria-live="polite">
          No favorites yet. Click the heart in the edit view to add images.
        </p>
      )}
      <ThumbnailMoreMenu
        isOpen={openMoreMenuIndex !== null}
        anchorRect={moreMenuAnchorRect}
        onClose={() => {
          setOpenMoreMenuIndex(null)
          setMoreMenuAnchorRect(null)
        }}
        isFavorited={true}
        onAction={(action) => {
          if (action === 'Unfavorite image' && openMoreMenuIndex !== null) {
            const imageSrc = favoriteTiles[openMoreMenuIndex]!.src
            setFavoritedImageSrcs((prev) => prev.filter((src) => src !== imageSrc))
          }
        }}
      />
      <aside className="gallery-chat-column" aria-label="Favorites chat column" />
    </main>
  )
}

export default FavoritesView
