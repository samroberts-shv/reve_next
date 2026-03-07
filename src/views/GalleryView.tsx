import { useRef, useCallback, useState } from 'react'
import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import moreGlyph from '../assets/glyphs/more.svg'
import ThumbnailMoreMenu from '../components/ThumbnailMoreMenu'
import type { DynamicChatEntry } from '../App'

type GalleryViewProps = {
  fixedLastImageSrc: string
  placeholderImageSrcs: string[]
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
  favoritedImageSrcs: string[]
  setFavoritedImageSrcs: Dispatch<SetStateAction<string[]>>
  dynamicChatEntries?: DynamicChatEntry[]
}

const galleryTileMinSizePx = 200
const galleryTileMaxSizePx = 300
const galleryTileGapPx = 10
const galleryChatColumnWidthPx = 320

const galleryChatScript = [
  {
    user: 'create a snowy scene in the mountains of mont blanc',
    reve: "I'll create four wintertime Mont Blanc mountain scenes for you.",
  },
  {
    user: 'remove the animals and make it less snowy',
    reve: "I'll create four less snowy images without animals.",
  },
  {
    user: 'create a trail going through a forest',
    reve: "I'll create four images of a forest trail for you.",
  },
  {
    user:
      'create a scenic monte blanc view with a path leading away form the camera. snow covered mountains in the distance, but warm green plants and trees nearby. dotted with wild flowers.',
    reve:
      "I'll create three scenic Mont Blanc views with that beautiful contrast of snowy peaks and lush foreground.",
  },
  {
    user: 'Make the valley more pronounced and make sure snow-capped mountains are visible in the distance',
    reve: "I'll create two scenic Mont Blanc views with that beautiful contrast of snowy peaks and lush foreground.",
  },
]
const chatTimestamps = ['18 minutes ago', '17 minutes ago', '6 minutes ago', '2 minutes ago', 'Just now']
const galleryResponseImageRanges = [
  { start: 0, end: 4 },
  { start: 4, end: 8 },
  { start: 8, end: 11 },
  { start: 11, end: 14 },
  { start: 14, end: 16 },
]

function GalleryView({
  fixedLastImageSrc,
  placeholderImageSrcs,
  resolveThumbnailSrc,
  resolveImageName,
  resolveImageDate,
  onOpenEditView,
  showThumbnails,
  isImageHidden = false,
  favoritedImageSrcs,
  setFavoritedImageSrcs,
  dynamicChatEntries = [],
}: GalleryViewProps) {
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

  const galleryTiles = [
    ...placeholderImageSrcs.map((src) => ({
      kind: 'image' as const,
      src,
    })),
    {
      kind: 'image' as const,
      src: fixedLastImageSrc,
    },
  ]
  const responseThumbnailGroups = galleryResponseImageRanges.map((range) =>
    galleryTiles.slice(range.start, range.end).map((tile, localIndex) => ({
      src: tile.src,
      tileIndex: range.start + localIndex,
    })),
  )
  const galleryGridRef = useRef<HTMLElement | null>(null)
  const [openMoreMenuIndex, setOpenMoreMenuIndex] = useState<number | null>(null)
  const [moreMenuAnchorRect, setMoreMenuAnchorRect] = useState<DOMRect | null>(null)

  const applyHighlight = useCallback((highlightedIndex: number | null) => {
    const grid = galleryGridRef.current
    if (!grid) return
    const buttons = grid.querySelectorAll<HTMLButtonElement>('.gallery-view-thumb-button')
    buttons.forEach((btn, index) => {
      if (highlightedIndex === null) {
        btn.style.opacity = ''
        btn.style.transform = ''
        btn.style.position = ''
        btn.style.zIndex = ''
      } else {
        btn.style.opacity = index === highlightedIndex ? '' : '0.2'
        btn.style.transform = index === highlightedIndex ? 'scale(1.1)' : ''
        btn.style.position = index === highlightedIndex ? 'relative' : ''
        btn.style.zIndex = index === highlightedIndex ? '1' : ''
      }
    })
    // Scroll the highlighted thumbnail into view
    if (highlightedIndex !== null && buttons[highlightedIndex]) {
      buttons[highlightedIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  return (
    <main className="gallery-view-stage">
      {showThumbnails && (
        <section
          ref={galleryGridRef}
          className="gallery-grid"
          style={{ gridTemplateColumns: `repeat(${gridColumns}, ${tileSize}px)` }}
          aria-label="Gallery thumbnails"
        >
          {galleryTiles.map((tile, index) => (
            <button
              key={`image-${index}-${tile.src}`}
              className={`gallery-view-thumb-button${isImageHidden && index === galleryTiles.length - 1 ? ' gallery-view-thumb-button--hidden' : ''}`}
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
      <ThumbnailMoreMenu
        isOpen={openMoreMenuIndex !== null}
        anchorRect={moreMenuAnchorRect}
        onClose={() => {
          setOpenMoreMenuIndex(null)
          setMoreMenuAnchorRect(null)
        }}
        isFavorited={
          openMoreMenuIndex !== null && favoritedImageSrcs.includes(galleryTiles[openMoreMenuIndex]!.src)
        }
        onAction={(action) => {
          if (openMoreMenuIndex === null) return
          const imageSrc = galleryTiles[openMoreMenuIndex]!.src
          if (action === 'Favorite image') {
            setFavoritedImageSrcs((prev) => (prev.includes(imageSrc) ? prev : [...prev, imageSrc]))
          } else if (action === 'Unfavorite image') {
            setFavoritedImageSrcs((prev) => prev.filter((src) => src !== imageSrc))
          }
        }}
      />
      <aside className="gallery-chat-column" aria-label="Gallery chat column">
        <div className="collection-chat-scroll collection-chat-scroll--gallery">
          {galleryChatScript.map((entry, index) => (
            <section className="collection-chat-entry" key={`gallery-chat-${index}`}>
              <div className="collection-chat-turn collection-chat-turn--user">
                <div className="collection-chat-user-block">
                  <p className="collection-chat-timestamp">{chatTimestamps[index] ?? ''}</p>
                  <p className="collection-chat-bubble">{entry.user}</p>
                </div>
              </div>
              <div className="collection-chat-turn collection-chat-turn--assistant">
                <div>
                  <p className="collection-chat-response">{entry.reve}</p>
                  <div
                    className="collection-chat-thumb-row"
                    style={{ '--thumb-count': (responseThumbnailGroups[index] ?? []).length } as CSSProperties}
                    aria-label="Result images"
                  >
                    {(responseThumbnailGroups[index] ?? []).map((thumbnail) => (
                      <button
                        key={`gallery-chat-thumb-${index}-${thumbnail.tileIndex}`}
                        className="collection-chat-thumb-button"
                        type="button"
                        aria-label="Open result in edit view"
                        onMouseEnter={() => applyHighlight(thumbnail.tileIndex)}
                        onMouseLeave={() => applyHighlight(null)}
                        onClick={(event) => {
                          const thumbnailImage = event.currentTarget.querySelector('img')
                          const imageAspectRatio =
                            thumbnailImage && thumbnailImage.naturalWidth > 0 && thumbnailImage.naturalHeight > 0
                              ? thumbnailImage.naturalWidth / thumbnailImage.naturalHeight
                              : undefined
                          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                          onOpenEditView(thumbnail.src, thumbnail.tileIndex, imageAspectRatio, rect)
                        }}
                      >
                        <img className="collection-chat-thumb-image" src={resolveThumbnailSrc(thumbnail.src)} alt="" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ))}
          {dynamicChatEntries.map((entry, index) => (
            <section className="collection-chat-entry" key={`gallery-chat-dynamic-${index}`}>
              <div className="collection-chat-turn collection-chat-turn--user">
                <div className="collection-chat-user-block">
                  <p className="collection-chat-timestamp">{entry.timestamp}</p>
                  <p className="collection-chat-bubble">{entry.user}</p>
                </div>
              </div>
              <div className="collection-chat-turn collection-chat-turn--assistant">
                <div>
                  <p className="collection-chat-response">{entry.reve}</p>
                  <div
                    className="collection-chat-thumb-row"
                    style={{ '--thumb-count': entry.imageSrcs.length } as CSSProperties}
                    aria-label="Result images"
                  >
                    {entry.imageSrcs.map((src, thumbIndex) => {
                      const tileIndex = galleryTiles.findIndex((t) => t.src === src)
                      return (
                        <button
                          key={`gallery-chat-dynamic-thumb-${index}-${thumbIndex}`}
                          className="collection-chat-thumb-button"
                          type="button"
                          aria-label="Open result in edit view"
                          onMouseEnter={() => tileIndex >= 0 && applyHighlight(tileIndex)}
                          onMouseLeave={() => applyHighlight(null)}
                          onClick={(event) => {
                            const thumbnailImage = event.currentTarget.querySelector('img')
                            const imageAspectRatio =
                              thumbnailImage && thumbnailImage.naturalWidth > 0 && thumbnailImage.naturalHeight > 0
                                ? thumbnailImage.naturalWidth / thumbnailImage.naturalHeight
                                : undefined
                            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                            onOpenEditView(src, tileIndex >= 0 ? tileIndex : galleryTiles.length - 1, imageAspectRatio, rect)
                          }}
                        >
                          <img className="collection-chat-thumb-image" src={resolveThumbnailSrc(src)} alt="" aria-hidden="true" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </aside>
    </main>
  )
}

export default GalleryView
