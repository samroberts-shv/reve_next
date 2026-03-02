import { type CSSProperties, type Dispatch, type SetStateAction, useEffect, useLayoutEffect, useRef, useState } from 'react'
import moreGlyph from '../assets/glyphs/more.svg'
import ThumbnailMoreMenu from '../components/ThumbnailMoreMenu'

type TrancheViewProps = {
  fixedLastImageSrc: string
  placeholderImageSrcs: string[]
  resolveImageSrc: (src: string) => string
  resolveImageName: (src: string, index?: number) => string
  resolveImageDate: (src: string, index?: number) => string
  onSuggestionClick?: (suggestion: string) => void
  onOpenEditView: (
    imageSrc: string,
    tileIndex: number,
    imageAspectRatio?: number,
    fromRect?: { left: number; top: number; width: number; height: number },
    trancheIndex?: number,
  ) => void
  scrollToTrancheIndex?: number | null
  onScrollToTrancheComplete?: () => void
  showThumbnails: boolean
  isImageHidden?: boolean
  favoritedImageSrcs: string[]
  setFavoritedImageSrcs: Dispatch<SetStateAction<string[]>>
}

const trancheTileGapPx = 10
const trancheMasonryMinColumnWidthPx = 380
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
const chatTimestamps = ['18 minutes ago', '17 minutes ago', '6 minutes ago', '2 minutes ago', 'Just now']

const trancheSuggestions: string[][] = [
  ['Add warmer tones to the alpine valley', 'Emphasize the forest path leading to the peak', 'Add morning mist to the mountain vista'],
  ['Enhance the meadow wildflowers', 'Add golden light to the distant summit', 'Deepen the valley shadows for drama'],
  ['Add dappled sunlight through the trees', 'Widen the mountain path perspective', 'Add a distant hiker to the scenic overlook'],
  ['Brighten the wildflower colors', 'Add pine cone details to the ridge', 'Create a sunrise glow at the trail head'],
  ['Emphasize the snow-capped peaks in the distance', 'Add autumn colors to the valley approach', 'Widen the Mont Blanc trail vista'],
]

function TrancheView({
  fixedLastImageSrc,
  placeholderImageSrcs,
  resolveImageSrc,
  resolveImageName,
  resolveImageDate,
  onSuggestionClick,
  onOpenEditView,
  showThumbnails,
  isImageHidden = false,
  favoritedImageSrcs,
  setFavoritedImageSrcs,
  scrollToTrancheIndex,
  onScrollToTrancheComplete,
}: TrancheViewProps) {
  const trancheGroupsRef = useRef<HTMLElement | null>(null)
  const [openMoreMenuIndex, setOpenMoreMenuIndex] = useState<number | null>(null)
  const [moreMenuAnchorRect, setMoreMenuAnchorRect] = useState<DOMRect | null>(null)
  const [visibleTrancheIndex, setVisibleTrancheIndex] = useState(0)
  const prevVisibleTrancheIndexRef = useRef(0)
  const [chatTransition, setChatTransition] = useState<{
    outgoingIndex: number
    incomingIndex: number
    direction: 'up' | 'down'
  } | null>(null)

  useEffect(() => {
    const container = trancheGroupsRef.current
    if (!container) return
    const groups = container.querySelectorAll('.tranche-group')
    if (groups.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = Array.from(groups).indexOf(entry.target as Element)
            if (index >= 0) setVisibleTrancheIndex(index)
          }
        }
      },
      { root: container, threshold: [0.5, 0.75, 1] },
    )
    groups.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [showThumbnails])

  useEffect(() => {
    if (visibleTrancheIndex !== prevVisibleTrancheIndexRef.current) {
      const prevIndex = prevVisibleTrancheIndexRef.current
      const direction = visibleTrancheIndex > prevIndex ? 'up' : 'down'
      setChatTransition({ outgoingIndex: prevIndex, incomingIndex: visibleTrancheIndex, direction })
      prevVisibleTrancheIndexRef.current = visibleTrancheIndex
      const timeoutId = setTimeout(() => setChatTransition(null), 280)
      return () => clearTimeout(timeoutId)
    }
  }, [visibleTrancheIndex])

  useLayoutEffect(() => {
    if (!showThumbnails || scrollToTrancheIndex == null) return
    const container = trancheGroupsRef.current
    if (!container) return
    const groups = container.querySelectorAll('.tranche-group')
    const targetGroup = groups[scrollToTrancheIndex]
    if (targetGroup) {
      targetGroup.scrollIntoView({ behavior: 'instant', block: 'start' })
      onScrollToTrancheComplete?.()
    }
  }, [showThumbnails, scrollToTrancheIndex, onScrollToTrancheComplete])
  const availableWidth = Math.max(trancheMasonryMinColumnWidthPx, window.innerWidth - trancheTileGapPx * 2 - 20)
  const masonryColumnsByWidth = Math.max(
    1,
    Math.floor((availableWidth + trancheTileGapPx) / (trancheMasonryMinColumnWidthPx + trancheTileGapPx)),
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

  const getTrancheIndexForGlobalIndex = (globalIndex: number) =>
    trancheRanges.findIndex((r) => globalIndex >= r.start && globalIndex < r.end)

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

  const renderTrancheChatContent = (
    index: number,
    suggestionClick?: (s: string) => void,
    hideSuggestions = false,
  ) => {
    const entry = trancheChatScript[index]
    if (!entry) return null
    const timestamp = chatTimestamps[index] ?? ''
    const suggestions = hideSuggestions ? [] : (trancheSuggestions[index] ?? [])
    return (
      <>
        <div className="collection-chat-turn collection-chat-turn--user">
          <div className="collection-chat-user-block">
            <p className="collection-chat-timestamp">{timestamp}</p>
            <p className="collection-chat-bubble">{entry.user}</p>
          </div>
        </div>
        <div className="collection-chat-turn collection-chat-turn--assistant">
          <p className="collection-chat-response">{entry.reve}</p>
        </div>
        {suggestions.length > 0 && (
          <div className="tranche-chat-suggestions" aria-label="Suggested edits">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="tranche-chat-suggestion-link"
                onClick={() => suggestionClick?.(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <main className="gallery-view-stage gallery-view-stage--tranche">
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
                    const availableTrancheHeightPx = Math.max(200, window.innerHeight - 100)
                    const imageMaxHeightPx = Math.max(
                      150,
                      (availableTrancheHeightPx - (rowCount - 1) * trancheTileGapPx) / rowCount,
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
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                      const trancheIdx = getTrancheIndexForGlobalIndex(tile.globalIndex)
                      onOpenEditView(tile.src, tile.globalIndex, imageAspectRatio, rect, trancheIdx)
                    }}
                  >
                    <span
                      className="gallery-view-thumb-more"
                      role="button"
                      tabIndex={0}
                      aria-label="More options"
                      aria-haspopup="menu"
                      aria-expanded={openMoreMenuIndex === tile.globalIndex}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (openMoreMenuIndex === tile.globalIndex) {
                          setOpenMoreMenuIndex(null)
                          setMoreMenuAnchorRect(null)
                        } else {
                          setOpenMoreMenuIndex(tile.globalIndex)
                          setMoreMenuAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
                    >
                      <img src={moreGlyph} alt="" aria-hidden="true" />
                    </span>
                    <img
                      className="gallery-view-thumb-image tranche-masonry-image"
                      src={resolveImageSrc(tile.src)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="gallery-view-thumb-caption">
                      {resolveImageDate(tile.src, tile.globalIndex) && (
                        <span className="gallery-view-thumb-date">{resolveImageDate(tile.src, tile.globalIndex)}</span>
                      )}
                      <span className="gallery-view-thumb-name">{resolveImageName(tile.src, tile.globalIndex)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
          openMoreMenuIndex !== null && favoritedImageSrcs.includes(trancheTiles[openMoreMenuIndex]!.src)
        }
        onAction={(action) => {
          if (openMoreMenuIndex === null) return
          const imageSrc = trancheTiles[openMoreMenuIndex]!.src
          if (action === 'Favorite image') {
            setFavoritedImageSrcs((prev) => (prev.includes(imageSrc) ? prev : [...prev, imageSrc]))
          } else if (action === 'Unfavorite image') {
            setFavoritedImageSrcs((prev) => prev.filter((src) => src !== imageSrc))
          }
        }}
      />
      {chatTransition ? (
        <>
          {trancheChatScript[chatTransition.outgoingIndex] && (
            <div
              className={`tranche-chat-overlay tranche-chat-overlay--exiting tranche-chat-overlay--exiting-${chatTransition.direction}`}
              aria-label="Tranche chat"
              aria-hidden="true"
            >
              <div className="tranche-chat-scroll">
                <section className="tranche-chat-entry">
                  {renderTrancheChatContent(
                    chatTransition.outgoingIndex,
                    onSuggestionClick,
                    true,
                  )}
                </section>
              </div>
            </div>
          )}
          <div
            className={`tranche-chat-overlay tranche-chat-overlay--entering tranche-chat-overlay--entering-${chatTransition.direction}`}
            aria-label="Tranche chat"
          >
            <div className="tranche-chat-scroll">
              <section className="tranche-chat-entry">
                {renderTrancheChatContent(
                  chatTransition.incomingIndex,
                  onSuggestionClick,
                  false,
                )}
              </section>
            </div>
          </div>
        </>
      ) : (
        trancheChatScript[visibleTrancheIndex] && (
          <div className="tranche-chat-overlay" aria-label="Tranche chat">
            <div className="tranche-chat-scroll">
              <section className="tranche-chat-entry" key={`tranche-chat-${visibleTrancheIndex}`}>
                {renderTrancheChatContent(visibleTrancheIndex, onSuggestionClick, false)}
              </section>
            </div>
          </div>
        )
      )}
    </main>
  )
}

export default TrancheView
