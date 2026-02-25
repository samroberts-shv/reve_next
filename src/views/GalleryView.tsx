type GalleryViewProps = {
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

function GalleryView({
  fixedLastImageSrc,
  placeholderImageSrcs,
  resolveThumbnailSrc,
  onOpenEditView,
  showThumbnails,
  isImageHidden = false,
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

  return (
    <main className="gallery-view-stage">
      {showThumbnails && (
        <section
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
      <aside className="gallery-chat-column" aria-label="Gallery chat column">
        <div className="collection-chat-scroll">
          {galleryChatScript.map((entry, index) => (
            <section className="collection-chat-entry" key={`gallery-chat-${index}`}>
              <div className="collection-chat-turn collection-chat-turn--user">
                <p className="collection-chat-bubble">{entry.user}</p>
              </div>
              <div className="collection-chat-turn collection-chat-turn--assistant">
                <p className="collection-chat-response">{entry.reve}</p>
              </div>
            </section>
          ))}
        </div>
      </aside>
    </main>
  )
}

export default GalleryView
