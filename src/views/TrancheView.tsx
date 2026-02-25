import { type CSSProperties, useEffect, useRef } from 'react'

type TrancheViewProps = {
  fixedLastImageSrc: string
  placeholderImageSrcs: string[]
  resolveThumbnailSrc: (src: string) => string
  onOpenEditView: (imageSrc: string, tileIndex: number, imageAspectRatio?: number) => void
  showThumbnails: boolean
  isImageHidden?: boolean
}

const galleryTileMinSizePx = 200
const galleryTileGapPx = 10
const galleryChatColumnWidthPx = 320
const trancheMasonryMinColumnWidthPx = 420
const trancheChatScript = [
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

function TrancheView({
  fixedLastImageSrc,
  placeholderImageSrcs,
  resolveThumbnailSrc,
  onOpenEditView,
  showThumbnails,
  isImageHidden = false,
}: TrancheViewProps) {
  const trancheGroupsRef = useRef<HTMLElement | null>(null)
  const trancheChatScrollRef = useRef<HTMLDivElement | null>(null)
  const isSyncingScrollRef = useRef(false)
  const availableWidth = Math.max(galleryTileMinSizePx, window.innerWidth - galleryChatColumnWidthPx - galleryTileGapPx * 2)
  const masonryColumnsByWidth = Math.max(
    1,
    Math.floor((availableWidth + galleryTileGapPx) / (trancheMasonryMinColumnWidthPx + galleryTileGapPx)),
  )

  const trancheTiles = [
    ...placeholderImageSrcs.map((src) => ({
      kind: 'image' as const,
      src,
    })),
    {
      kind: 'image' as const,
      src: fixedLastImageSrc,
    },
  ]
  const trancheRanges = [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
    { start: 8, end: 11 },
    { start: 11, end: 14 },
    { start: 14, end: 16 },
  ]
  const tranches = trancheRanges
    .map((range) =>
      trancheTiles.slice(range.start, range.end).map((tile, localIndex) => ({
        ...tile,
        globalIndex: range.start + localIndex,
      })),
    )
    .filter((tranche) => tranche.length > 0)

  const getTrancheColumnCount = (trancheLength: number) => {
    const preferredColumns = trancheLength <= 2 ? trancheLength : 2
    return Math.max(1, Math.min(masonryColumnsByWidth, preferredColumns))
  }

  useEffect(() => {
    const groupsElement = trancheGroupsRef.current
    const chatElement = trancheChatScrollRef.current
    if (!groupsElement || !chatElement) {
      return
    }

    const getScrollProgress = (element: HTMLElement) => {
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight)
      if (maxScroll === 0) {
        return 0
      }
      return element.scrollTop / maxScroll
    }

    const setScrollFromProgress = (element: HTMLElement, progress: number) => {
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight)
      element.scrollTop = progress * maxScroll
    }

    const syncChatScroll = () => {
      if (isSyncingScrollRef.current) {
        return
      }
      isSyncingScrollRef.current = true
      setScrollFromProgress(chatElement, getScrollProgress(groupsElement))
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false
      })
    }
    const syncGroupScroll = () => {
      if (isSyncingScrollRef.current) {
        return
      }
      isSyncingScrollRef.current = true
      setScrollFromProgress(groupsElement, getScrollProgress(chatElement))
      window.requestAnimationFrame(() => {
        isSyncingScrollRef.current = false
      })
    }
    syncChatScroll()
    groupsElement.addEventListener('scroll', syncChatScroll, { passive: true })
    chatElement.addEventListener('scroll', syncGroupScroll, { passive: true })
    return () => {
      groupsElement.removeEventListener('scroll', syncChatScroll)
      chatElement.removeEventListener('scroll', syncGroupScroll)
    }
  }, [])

  return (
    <main className="gallery-view-stage">
      {showThumbnails && (
        <section className="tranche-groups" aria-label="Tranche thumbnails" ref={trancheGroupsRef}>
          {tranches.map((tranche, trancheIndex) => (
            <div key={`tranche-${trancheIndex}`} className="tranche-group">
              <div
                className="tranche-grid"
                style={
                  (() => {
                    const columnCount = getTrancheColumnCount(tranche.length)
                    const rowCount = Math.ceil(tranche.length / columnCount)
                    const availableTrancheHeightPx = Math.max(120, window.innerHeight - 90)
                    const imageMaxHeightPx = Math.max(
                      80,
                      (availableTrancheHeightPx - (rowCount - 1) * galleryTileGapPx) / rowCount,
                    )
                    return {
                      columnCount,
                      '--tranche-image-max-height': `${imageMaxHeightPx}px`,
                    } as CSSProperties
                  })()
                }
              >
                {tranche.map((tile) => (
                  <button
                    key={`image-${tile.globalIndex}-${tile.src}`}
                    className={`gallery-view-thumb-button tranche-masonry-item${
                      isImageHidden && tile.globalIndex === trancheTiles.length - 1 ? ' gallery-view-thumb-button--hidden' : ''
                    }`}
                    type="button"
                    aria-label="Open image in edit view"
                    onClick={(event) => {
                      const thumbnailImage = event.currentTarget.querySelector('img')
                      const imageAspectRatio =
                        thumbnailImage && thumbnailImage.naturalWidth > 0 && thumbnailImage.naturalHeight > 0
                          ? thumbnailImage.naturalWidth / thumbnailImage.naturalHeight
                          : undefined
                      onOpenEditView(tile.src, tile.globalIndex, imageAspectRatio)
                    }}
                  >
                    <img
                      className="gallery-view-thumb-image tranche-masonry-image"
                      src={resolveThumbnailSrc(tile.src)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      <aside className="gallery-chat-column" aria-label="Tranche chat column">
        <div className="collection-chat-scroll collection-chat-scroll--tranche" ref={trancheChatScrollRef}>
          {trancheChatScript.map((entry, index) => (
            <section className="collection-chat-entry collection-chat-entry--tranche" key={`tranche-chat-${index}`}>
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

export default TrancheView
