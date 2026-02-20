import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import './App.css'
import { hasNoAdjustments, normalizeAdjustParams } from './adjustParams'
import montBlancTrail from './assets/photos/montblanctrail.jpg'
import { createAdjustRenderer } from './imageAdjustWebGL'
import reveLogo from './assets/reve_logo.svg'
import favOffGlyph from './assets/glyphs/fav_off.svg'
import shareGlyph from './assets/glyphs/share.svg'
import moreGlyph from './assets/glyphs/more.svg'
import trashGlyph from './assets/glyphs/trash.svg'
import textGlyph from './assets/glyphs/text.svg'
import objectGlyph from './assets/glyphs/object.svg'
import referenceGlyph from './assets/glyphs/reference.svg'
import webGlyph from './assets/glyphs/web.svg'
import cameraGlyph from './assets/glyphs/camera.svg'
import closeGlyph from './assets/glyphs/close.svg'
import searchGlyph from './assets/glyphs/search.svg'
import adjustGlyph from './assets/glyphs/adjust.svg'
import upscaleGlyph from './assets/glyphs/upscale.svg'
import isolateGlyph from './assets/glyphs/isolate.svg'
import varyGlyph from './assets/glyphs/vary.svg'
import boundingBoxTl from './assets/boundingbox/tl.png'
import boundingBoxTr from './assets/boundingbox/tr.png'
import boundingBoxBl from './assets/boundingbox/bl.png'
import boundingBoxBr from './assets/boundingbox/br.png'

type Tool = 'commentDraw' | 'select' | 'reframe'
type BottomLeftMenu = 'info' | 'objects' | 'adjust' | 'effects' | 'quickEdit' | null

const TOOL_INSTRUCTIONS: Record<Tool, string> = {
  commentDraw:
    'Click or draw to describe the change you want. Hold option/alt to draw a box.',
  select: 'Select, move and edit objects.',
  reframe: 'Edit the aspect ratio and framing.',
}

const ADJUST_SLIDER_IDS = [
  'Temp',
  'Tint',
  'Exposure',
  'Contrast',
  'Highlights',
  'Shadows',
  'Vibrance',
  'Saturation',
] as const
type SourcePoint = { x: number; y: number }
type SourceBounds = { x: number; y: number; width: number; height: number }
type CommentPanelState = 'expanded' | 'collapsed'
type SearchThumbnail = { id: string; name: string; src: string }
type PendingEdit = {
  id: string
  text: string
  annotation: CommentAnnotation
}
type RenderRevealTransition = {
  previousImageSrc: string
  nextImageSrc: string
  startingBlurPx: number
}
type RenderHistoryItem = {
  id: string
  src: string
}
type CommentAnnotation = {
  id: string
  kind: 'point' | 'stroke'
  point: SourcePoint
  strokePoints: SourcePoint[]
  strokeBounds: SourceBounds | null
  text: string
  panelState: CommentPanelState
  panelPosition: { left: number; top: number }
}

const imageDescription =
  'A wide-angle landscape photograph of a lush green valley with a winding dirt path leading towards a snow-capped mountain range under a clear blue sky. The mountain range is partially covered in snow, with some rocky areas visible. The sky is a clear, vibrant blue. The image has a deep depth of field, with both the foreground and background in sharp focus. The lighting is natural and even, suggesting a daytime scene. The composition is balanced, with the path leading the eye towards the mountains. The foreground features a variety of wildflowers, including purple and yellow blossoms, and several evergreen trees of varying sizes. The dirt path is light brown and winds through the valley.'

const objectThumbnailModules = import.meta.glob('./assets/objects/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const objectThumbnails = Object.entries(objectThumbnailModules)
  .map(([path, src]) => ({
    name: path.split('/').pop()?.replace('.jpg', '').replaceAll('_', ' ') ?? 'object',
    src,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const referenceThumbnailModules = import.meta.glob('./assets/references/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const referenceThumbnails = Object.entries(referenceThumbnailModules)
  .map(([path, src]) => ({
    name: path.split('/').pop()?.replace('.png', '').replaceAll('_', ' ') ?? 'reference',
    src,
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

const recentReferenceThumbnails = referenceThumbnails
  .slice(0, 6)

const effectNames = [
  'Cinematic',
  'Moody',
  'Vintage',
  'Black & White',
  'High Contrast',
  'Soft Glow',
  'Cool Tones',
  'Warm Film',
  'Matte',
  'Sepia',
  'Vivid',
  'Fade',
  'Dramatic',
  'Neutral',
  'Golden Hour',
]
const sourceImageSize = {
  width: 2720,
  height: 1536,
}

const imageObjects = [
  { name: 'Valley', x: 0, y: 72, width: 2720, height: 1464 },
  { name: 'Sky', x: 0, y: 0, width: 2720, height: 341 },
  { name: 'Nearby Trees', x: 87, y: 340, width: 650, height: 695 },
  { name: 'Mountains', x: 628, y: 152, width: 1452, height: 402 },
  { name: 'Path', x: 850, y: 709, width: 863, height: 827 },
  { name: 'Yellow Wild Flowers', x: 631, y: 1043, width: 185, height: 238 },
  { name: 'Purple Wild Flowers', x: 876, y: 1076, width: 194, height: 157 },
  { name: 'Pink Wild Flowers', x: 2263, y: 1129, width: 230, height: 146 },
  { name: 'White Wild Flowers', x: 1555, y: 613, width: 745, height: 369 },
  { name: 'White Wild Flowers 2', x: 134, y: 1249, width: 487, height: 287 },
  { name: 'Distant Trees', x: 969, y: 493, width: 332, height: 280 },
  { name: 'Distant Trees 2', x: 1463, y: 354, width: 548, height: 367 },
  { name: 'Distant Tree', x: 2225, y: 134, width: 297, height: 423 },
  { name: 'Farm House', x: 1301, y: 589, width: 83, height: 74 },
]

const normalizeObjectName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

const imageObjectNameLookup = new Map(imageObjects.map((imageObject) => [normalizeObjectName(imageObject.name), imageObject.name]))

const objectThumbnailsWithObjectName = objectThumbnails.map((objectThumbnail) => ({
  ...objectThumbnail,
  objectName: imageObjectNameLookup.get(normalizeObjectName(objectThumbnail.name)) ?? null,
}))

const getObjectBoxStyle = (imageObject: (typeof imageObjects)[number]) => ({
  left: `${(imageObject.x / sourceImageSize.width) * 100}%`,
  top: `${(imageObject.y / sourceImageSize.height) * 100}%`,
  width: `${(imageObject.width / sourceImageSize.width) * 100}%`,
  height: `${(imageObject.height / sourceImageSize.height) * 100}%`,
})

const getSmallestObjectAtSourcePoint = (sourceX: number, sourceY: number) =>
  imageObjects
    .filter(
      (imageObject) =>
        sourceX >= imageObject.x &&
        sourceX <= imageObject.x + imageObject.width &&
        sourceY >= imageObject.y &&
        sourceY <= imageObject.y + imageObject.height,
    )
    .sort((objectA, objectB) => objectA.width * objectA.height - objectB.width * objectB.height)[0] ?? null

const getSmallestObjectAtClientPoint = (clientX: number, clientY: number, imageFrameBounds: DOMRect) => {
  const localX = clientX - imageFrameBounds.left
  const localY = clientY - imageFrameBounds.top
  const sourceX = (localX / imageFrameBounds.width) * sourceImageSize.width
  const sourceY = (localY / imageFrameBounds.height) * sourceImageSize.height

  return getSmallestObjectAtSourcePoint(sourceX, sourceY)
}

const objectPromptDescriptions: Record<string, string> = {
  Valley:
    'a wide, lush green valley with rolling hills and wild grasses stretching toward the mountains.',
  Sky: 'a clear blue sky with soft clouds and bright daylight.',
  'Nearby Trees':
    'evergreen trees in the foreground with dense foliage and dark green needles.',
  Mountains:
    'snow-capped mountain peaks in the distance with rocky ridges and alpine terrain.',
  Path: 'a light brown dirt path winding through the valley toward the mountains.',
  'Yellow Wild Flowers':
    'clusters of small yellow wildflowers growing along the path.',
  'Purple Wild Flowers':
    'patches of purple wildflowers mixed with the grass and yellow blooms.',
  'Pink Wild Flowers':
    'scattered pink wildflowers in the meadow on the right side of the scene.',
  'White Wild Flowers':
    'white wildflowers and blooms in a large patch in the mid-ground.',
  'White Wild Flowers 2':
    'another patch of white wildflowers near the lower edge of the frame.',
  'Distant Trees':
    'trees in the middle distance with softer detail and muted green tones.',
  'Distant Trees 2':
    'a second group of distant trees with foliage receding toward the mountains.',
  'Distant Tree':
    'a single tall tree standing in the distance against the sky.',
  'Farm House':
    'a small, quaint farm house that is painted white and has a brown roof.',
}

const getObjectPromptText = (objectName: string) =>
  objectPromptDescriptions[objectName] ?? `the ${objectName.toLowerCase()} in this scene.`

const clampVectorMagnitude = (x: number, y: number, maxMagnitude: number) => {
  const magnitude = Math.hypot(x, y)
  if (magnitude <= maxMagnitude || magnitude === 0) {
    return { x, y }
  }

  const scale = maxMagnitude / magnitude
  return { x: x * scale, y: y * scale }
}

const getObjectPromptPanelPosition = (imageObject: (typeof imageObjects)[number], imageFrameBounds: DOMRect, panelHeight: number) => {
  const panelWidth = 200
  const viewportMargin = 10
  const panelGap = 10
  const objectCenterX = imageFrameBounds.left + ((imageObject.x + imageObject.width / 2) / sourceImageSize.width) * imageFrameBounds.width
  const objectTopY = imageFrameBounds.top + (imageObject.y / sourceImageSize.height) * imageFrameBounds.height
  const objectBottomY = imageFrameBounds.top + ((imageObject.y + imageObject.height) / sourceImageSize.height) * imageFrameBounds.height
  const hasSpaceAbove = objectTopY - panelGap - panelHeight >= viewportMargin
  const preferredTop = hasSpaceAbove ? objectTopY - panelGap - panelHeight : objectBottomY + panelGap
  const left = Math.min(
    Math.max(objectCenterX - panelWidth / 2, viewportMargin),
    window.innerWidth - panelWidth - viewportMargin,
  )
  const top = Math.min(
    Math.max(preferredTop, viewportMargin),
    Math.max(viewportMargin, window.innerHeight - panelHeight - viewportMargin),
  )

  return { left, top }
}

const commentTextPlaceholder = 'Change this...'
const addMenuWidth = 300
const addMenuFixedHeight = 420
const addMenuEstimatedHeight = addMenuFixedHeight
const addMenuViewportMargin = 10
const pexelsResultsPerPage = 21
const pendingEditThumbnailSize = 30
const renderBlurMinPx = 20
const renderBlurMaxPx = 100
const renderBlurCycleMs = 3000
const renderRevealCrossfadeMs = 500
const renderRevealSharpenMs = 500
const filmstripThumbnailHeightPx = 50
const filmstripBottomGapPx = 10
const filmstripControlsGapPx = 10
const prototypePastWebSearches = [
  'Porsche 912',
  'Standford Tree',
  'Anaconda',
  'Galaxy',
  'Santa Cruz Boardwalk',
  'Modern Painting',
]

const sourcePointToPercent = (point: SourcePoint) => ({
  left: `${(point.x / sourceImageSize.width) * 100}%`,
  top: `${(point.y / sourceImageSize.height) * 100}%`,
})

const sourcePointToClient = (point: SourcePoint, imageFrameBounds: DOMRect) => ({
  x: imageFrameBounds.left + (point.x / sourceImageSize.width) * imageFrameBounds.width,
  y: imageFrameBounds.top + (point.y / sourceImageSize.height) * imageFrameBounds.height,
})

const clientPointToSource = (clientX: number, clientY: number, imageFrameBounds: DOMRect): SourcePoint => ({
  x: ((clientX - imageFrameBounds.left) / imageFrameBounds.width) * sourceImageSize.width,
  y: ((clientY - imageFrameBounds.top) / imageFrameBounds.height) * sourceImageSize.height,
})

const getStrokeBounds = (points: SourcePoint[]): SourceBounds | null => {
  if (points.length === 0) {
    return null
  }

  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y

  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
  })

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  }
}

const getCommentAnchorPoint = (commentAnnotation: CommentAnnotation): SourcePoint => {
  if (commentAnnotation.kind === 'point' || !commentAnnotation.strokeBounds) {
    return commentAnnotation.point
  }

  return {
    x: commentAnnotation.strokeBounds.x + commentAnnotation.strokeBounds.width / 2,
    y: commentAnnotation.strokeBounds.y,
  }
}

const getAddMenuPosition = (triggerBounds: DOMRect) => {
  const horizontalMax = Math.max(addMenuViewportMargin, window.innerWidth - addMenuWidth - addMenuViewportMargin)
  const left = Math.min(Math.max(triggerBounds.right - addMenuWidth, addMenuViewportMargin), horizontalMax)
  const preferredTop = triggerBounds.top - addMenuEstimatedHeight - addMenuViewportMargin
  const fallbackTop = triggerBounds.bottom + addMenuViewportMargin
  const verticalMax = Math.max(addMenuViewportMargin, window.innerHeight - addMenuEstimatedHeight - addMenuViewportMargin)
  const top =
    preferredTop >= addMenuViewportMargin
      ? preferredTop
      : Math.min(Math.max(fallbackTop, addMenuViewportMargin), verticalMax)

  return { left, top }
}

const clampAddMenuPosition = (position: { left: number; top: number }, menuWidth: number, menuHeight: number) => {
  const horizontalMax = Math.max(addMenuViewportMargin, window.innerWidth - menuWidth - addMenuViewportMargin)
  const verticalMax = Math.max(addMenuViewportMargin, window.innerHeight - menuHeight - addMenuViewportMargin)
  return {
    left: Math.min(Math.max(position.left, addMenuViewportMargin), horizontalMax),
    top: Math.min(Math.max(position.top, addMenuViewportMargin), verticalMax),
  }
}

const getCommentPanelPosition = (anchorPoint: SourcePoint, imageFrameBounds: DOMRect, panelHeight: number) => {
  const panelWidth = 300
  const viewportMargin = 10
  const panelGap = 10
  const anchorClient = sourcePointToClient(anchorPoint, imageFrameBounds)
  const left = Math.min(
    Math.max(anchorClient.x - panelWidth / 2, viewportMargin),
    window.innerWidth - panelWidth - viewportMargin,
  )
  const top = Math.min(
    Math.max(anchorClient.y - panelGap - panelHeight, viewportMargin),
    Math.max(viewportMargin, window.innerHeight - panelHeight - viewportMargin),
  )

  return { left, top }
}

const getCommentStrokePathData = (points: SourcePoint[]) => {
  if (points.length === 0) {
    return ''
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

const getRectStrokePoints = (start: SourcePoint, end: SourcePoint): SourcePoint[] => {
  const x0 = Math.min(start.x, end.x)
  const x1 = Math.max(start.x, end.x)
  const y0 = Math.min(start.y, end.y)
  const y1 = Math.max(start.y, end.y)
  const topLeft = { x: x0, y: y0 }
  const topRight = { x: x1, y: y0 }
  const bottomRight = { x: x1, y: y1 }
  const bottomLeft = { x: x0, y: y1 }
  return [topLeft, topRight, bottomRight, bottomLeft, topLeft]
}

function App() {
  const [selectedTool, setSelectedTool] = useState<Tool>('commentDraw')
  const [toolInstructionFadedOut, setToolInstructionFadedOut] = useState(false)
  const toolInstructionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [activeBottomLeftMenu, setActiveBottomLeftMenu] = useState<BottomLeftMenu>(null)
  const [adjustSliderValues, setAdjustSliderValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(ADJUST_SLIDER_IDS.map((id) => [id, 0])),
  )
  const [infoText, setInfoText] = useState(imageDescription)
  const [composerInput, setComposerInput] = useState('')
  const [composerChanges] = useState<string[]>([])
  const [displayImageSrc, setDisplayImageSrc] = useState(montBlancTrail)
  const [isReveRendering, setIsReveRendering] = useState(false)
  const [reveRenderError, setReveRenderError] = useState<string | null>(null)
  const [renderRevealTransition, setRenderRevealTransition] = useState<RenderRevealTransition | null>(null)
  const [renderHistory, setRenderHistory] = useState<RenderHistoryItem[]>([])
  const [showObjectOverlays, setShowObjectOverlays] = useState(false)
  const [hoveredObjectName, setHoveredObjectName] = useState<string | null>(null)
  const [hoveredObjectListName, setHoveredObjectListName] = useState<string | null>(null)
  const [activeObjectPromptName, setActiveObjectPromptName] = useState<string | null>(null)
  const [displayedObjectPromptName, setDisplayedObjectPromptName] = useState<string | null>(null)
  const [isObjectPromptClosing, setIsObjectPromptClosing] = useState(false)
  const [objectPromptTexts, setObjectPromptTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(imageObjects.map((imageObject) => [imageObject.name, getObjectPromptText(imageObject.name)])),
  )
  const [objectPromptPanelPosition, setObjectPromptPanelPosition] = useState({ left: 10, top: 10 })
  const [objectPromptFromOffset, setObjectPromptFromOffset] = useState({ x: 0, y: 0 })
  const [objectPromptAnimationKey, setObjectPromptAnimationKey] = useState(0)
  const [hoverTooltipPosition, setHoverTooltipPosition] = useState({ x: 0, y: 0 })
  const [commentCursorPosition, setCommentCursorPosition] = useState({ x: 0, y: 0 })
  const [showCommentCursorHint, setShowCommentCursorHint] = useState(false)
  const [commentAnnotations, setCommentAnnotations] = useState<CommentAnnotation[]>([])
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null)
  const [isDrawingCommentStroke, setIsDrawingCommentStroke] = useState(false)
  const [draftCommentStrokePoints, setDraftCommentStrokePoints] = useState<SourcePoint[]>([])
  const [draftCommentBoxStart, setDraftCommentBoxStart] = useState<SourcePoint | null>(null)
  const [draftCommentBoxEnd, setDraftCommentBoxEnd] = useState<SourcePoint | null>(null)
  const [commentPanelPosition, setCommentPanelPosition] = useState({ left: 10, top: 10 })
  const [isComposerAddMenuOpen, setIsComposerAddMenuOpen] = useState(false)
  const [addMenuPosition, setAddMenuPosition] = useState({ left: 10, top: 10 })
  const [isPendingEditsMenuOpen, setIsPendingEditsMenuOpen] = useState(false)
  const [isAddMenuReferenceBrowserOpen, setIsAddMenuReferenceBrowserOpen] = useState(false)
  const [addMenuSourceTab, setAddMenuSourceTab] = useState<'references' | 'webSearch'>('references')
  const [addMenuSearchQuery, setAddMenuSearchQuery] = useState('')
  const [webSearchResults, setWebSearchResults] = useState<SearchThumbnail[]>([])
  const [isWebSearchLoading, setIsWebSearchLoading] = useState(false)
  const [webSearchError, setWebSearchError] = useState<string | null>(null)
  const [hasWebSearchPerformed, setHasWebSearchPerformed] = useState(false)
  const [hoverCornerMarkerSize, setHoverCornerMarkerSize] = useState(36)
  const bottomLeftContainerRef = useRef<HTMLDivElement | null>(null)
  const infoTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const imageFrameRef = useRef<HTMLDivElement | null>(null)
  const objectPromptPanelRef = useRef<HTMLDivElement | null>(null)
  const objectPromptTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const objectPromptCloseTimeoutRef = useRef<number | null>(null)
  const commentPanelRef = useRef<HTMLDivElement | null>(null)
  const addMenuRef = useRef<HTMLElement | null>(null)
  const pendingEditsMenuRef = useRef<HTMLElement | null>(null)
  const commentLayerRef = useRef<HTMLDivElement | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const activeCommentRef = useRef<CommentAnnotation | null>(null)
  const commentPointerIdRef = useRef<number | null>(null)
  const commentStrokeStartPointRef = useRef<SourcePoint | null>(null)
  const draftCommentStrokePointsRef = useRef<SourcePoint[]>([])
  const commentBoxModeRef = useRef(false)
  const sourceImageRef = useRef<HTMLImageElement | null>(null)
  const heroWebGLCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const adjustRendererRef = useRef<ReturnType<typeof createAdjustRenderer> | null>(null)
  const renderCycleStartedAtRef = useRef<number | null>(null)
  const renderRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sourceImageLoaded, setSourceImageLoaded] = useState(false)
  const [pendingEditThumbnailSrcById, setPendingEditThumbnailSrcById] = useState<Record<string, string>>({})
  const [adjustSliderDraggingId, setAdjustSliderDraggingId] = useState<string | null>(null)
  const bottomLeftPanelRef = useRef<HTMLElement | null>(null)
  const adjustContentRef = useRef<HTMLDivElement | null>(null)

  const hasComposerChanges = composerInput.trim().length > 0 || composerChanges.length > 0 || commentAnnotations.length > 0
  const canRender = hasComposerChanges && !isReveRendering
  const hasRenderHistory = renderHistory.length > 0
  const controlsBottomPx = hasRenderHistory ? filmstripBottomGapPx + filmstripThumbnailHeightPx + filmstripControlsGapPx : 10
  const pendingEdits: PendingEdit[] = commentAnnotations
    .map((comment) => ({
      id: comment.id,
      text: comment.text.trim(),
      annotation: comment,
    }))
    .filter((pendingEdit) => pendingEdit.text.length > 0)
  const pendingEditCount = pendingEdits.length
  const isInteractionMenuOpen =
    activeBottomLeftMenu !== null ||
    isComposerAddMenuOpen ||
    isPendingEditsMenuOpen ||
    displayedObjectPromptName !== null ||
    activeCommentId !== null

  useLayoutEffect(() => {
    if (hasNoAdjustments(adjustSliderValues) || !sourceImageLoaded) {
      return
    }
    const canvas = heroWebGLCanvasRef.current
    const img = sourceImageRef.current
    if (!canvas || !img?.complete || img.naturalWidth === 0) {
      return
    }
    let renderer = adjustRendererRef.current
    if (renderer && renderer.canvas !== canvas) {
      renderer.destroy()
      adjustRendererRef.current = null
      renderer = null
    }
    if (!renderer) {
      renderer = createAdjustRenderer(canvas)
      adjustRendererRef.current = renderer
      if (!renderer) return
    }
    const updateSizeAndRender = () => {
      const r = adjustRendererRef.current
      const im = sourceImageRef.current
      const frame = imageFrameRef.current
      if (!r || !im || !frame) return
      const w = frame.clientWidth
      const h = Math.round((w * im.naturalHeight) / im.naturalWidth)
      r.setSize(w, h)
      r.render()
    }
    renderer.setImage(img)
    renderer.setParams(normalizeAdjustParams(adjustSliderValues))
    const frame = imageFrameRef.current
    if (frame) {
      const w = frame.clientWidth
      const h = Math.round((w * img.naturalHeight) / img.naturalWidth)
      renderer.setSize(w, h)
    }
    renderer.render()

    const ro = new ResizeObserver(updateSizeAndRender)
    ro.observe(frame!)
    return () => ro.disconnect()
  }, [adjustSliderValues, sourceImageLoaded])

  useEffect(() => {
    if (!isInteractionMenuOpen) {
      return
    }

    setHoveredObjectName(null)
    setShowCommentCursorHint(false)
    setIsDrawingCommentStroke(false)
    setDraftCommentStrokePoints([])
    setDraftCommentBoxStart(null)
    setDraftCommentBoxEnd(null)
    commentBoxModeRef.current = false
    commentPointerIdRef.current = null
    commentStrokeStartPointRef.current = null
    draftCommentStrokePointsRef.current = []
  }, [isInteractionMenuOpen])

  useEffect(() => {
    return () => {
      const r = adjustRendererRef.current
      if (r) {
        r.destroy()
        adjustRendererRef.current = null
      }
    }
  }, [])

  const finishClosingObjectPrompt = () => {
    setDisplayedObjectPromptName(null)
    setIsObjectPromptClosing(false)
    objectPromptCloseTimeoutRef.current = null
  }

  const closeObjectPrompt = () => {
    setActiveObjectPromptName(null)

    if (displayedObjectPromptName === null) {
      return
    }

    setIsObjectPromptClosing(true)

    if (objectPromptCloseTimeoutRef.current !== null) {
      window.clearTimeout(objectPromptCloseTimeoutRef.current)
    }

    objectPromptCloseTimeoutRef.current = window.setTimeout(finishClosingObjectPrompt, 100)
  }

  const openObjectPrompt = (objectName: string, imageFrameBounds: DOMRect) => {
    const objectForPrompt = imageObjects.find((imageObject) => imageObject.name === objectName)
    if (!objectForPrompt) {
      return
    }

    if (objectPromptCloseTimeoutRef.current !== null) {
      window.clearTimeout(objectPromptCloseTimeoutRef.current)
      objectPromptCloseTimeoutRef.current = null
    }

    setIsObjectPromptClosing(false)
    setActiveObjectPromptName(objectName)
    setDisplayedObjectPromptName(objectName)
    setObjectPromptAnimationKey((previous) => previous + 1)
    setObjectPromptPanelPosition(getObjectPromptPanelPosition(objectForPrompt, imageFrameBounds, 130))
  }

  const openCommentPanel = (commentId: string, imageFrameBounds: DOMRect) => {
    const commentAnnotation = commentAnnotations.find((comment) => comment.id === commentId)
    if (!commentAnnotation) {
      return
    }

    setSelectedTool('commentDraw')
    const nextPosition = getCommentPanelPosition(getCommentAnchorPoint(commentAnnotation), imageFrameBounds, 130)
    setCommentPanelPosition(nextPosition)
    setCommentAnnotations((previous) =>
      previous.map((comment) =>
        comment.id === commentId
          ? { ...comment, panelState: 'expanded', panelPosition: nextPosition }
          : { ...comment, panelState: 'collapsed' },
      ),
    )
    setActiveCommentId(commentId)
  }

  const collapseActiveCommentPanel = () => {
    if (!activeCommentId) {
      return
    }

    setCommentAnnotations((previous) =>
      previous.map((comment) => (comment.id === activeCommentId ? { ...comment, panelState: 'collapsed' } : comment)),
    )
    setActiveCommentId(null)
  }

  const createCommentAnnotation = (kind: 'point' | 'stroke', points: SourcePoint[], imageFrameBounds: DOMRect) => {
    if (points.length === 0) {
      return
    }

    const strokeBounds = kind === 'stroke' ? getStrokeBounds(points) : null
    const anchorPoint =
      kind === 'point' || !strokeBounds
        ? points[0]
        : { x: strokeBounds.x + strokeBounds.width / 2, y: strokeBounds.y }

    const panelPosition = getCommentPanelPosition(anchorPoint, imageFrameBounds, 130)
    const commentId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const commentAnnotation: CommentAnnotation = {
      id: commentId,
      kind,
      point: anchorPoint,
      strokePoints: kind === 'stroke' ? points : [],
      strokeBounds,
      text: '',
      panelState: 'expanded',
      panelPosition,
    }

    setCommentAnnotations((previous) =>
      previous
        .map((comment) => ({ ...comment, panelState: 'collapsed' as CommentPanelState }))
        .concat(commentAnnotation),
    )
    setCommentPanelPosition(panelPosition)
    setActiveCommentId(commentId)
  }

  const handleDeleteComment = (commentId: string) => {
    setCommentAnnotations((previous) => previous.filter((comment) => comment.id !== commentId))
    setActiveCommentId((previous) => (previous === commentId ? null : previous))
  }

  const handleCommentInputKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || !activeComment) {
      return
    }

    event.preventDefault()

    const isEmptyComment = activeComment.text.trim().length === 0

    if (isEmptyComment && activeComment.kind === 'point') {
      setCommentAnnotations((previous) => previous.filter((comment) => comment.id !== activeComment.id))
      setActiveCommentId(null)
      return
    }

    setCommentAnnotations((previous) =>
      previous.map((comment) => (comment.id === activeComment.id ? { ...comment, panelState: 'collapsed' } : comment)),
    )
    setActiveCommentId(null)
  }

  const handleAddMenuTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    const triggerBounds = event.currentTarget.getBoundingClientRect()
    setAddMenuPosition(getAddMenuPosition(triggerBounds))
    setIsAddMenuReferenceBrowserOpen(false)
    setAddMenuSourceTab('references')
    setAddMenuSearchQuery('')
    setWebSearchResults([])
    setWebSearchError(null)
    setHasWebSearchPerformed(false)
    setIsComposerAddMenuOpen(true)
  }

  const handleOpenAddMenuSourceBrowser = (source: 'references' | 'webSearch') => {
    setAddMenuSourceTab(source)
    setIsAddMenuReferenceBrowserOpen(true)
  }

  const handleRunPexelsWebSearch = async (queryOverride?: string) => {
    const query = (queryOverride ?? addMenuSearchQuery).trim()
    if (!query) {
      return
    }
    if (query !== addMenuSearchQuery) {
      setAddMenuSearchQuery(query)
    }

    const pexelsApiKey = (import.meta.env.VITE_PEXELS_API_KEY as string | undefined)?.trim()
    if (!pexelsApiKey) {
      setWebSearchError('Missing VITE_PEXELS_API_KEY.')
      setWebSearchResults([])
      setHasWebSearchPerformed(true)
      return
    }

    setIsWebSearchLoading(true)
    setWebSearchError(null)
    setHasWebSearchPerformed(true)

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${pexelsResultsPerPage}`,
        {
          headers: {
            Authorization: pexelsApiKey,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Pexels request failed (${response.status})`)
      }

      const data = (await response.json()) as {
        photos?: Array<{
          id: number
          alt: string
          photographer?: string
          src: { medium?: string; large?: string; original?: string }
        }>
      }

      const results: SearchThumbnail[] = (data.photos ?? [])
        .slice(0, pexelsResultsPerPage)
        .map((photo) => ({
          id: String(photo.id),
          name:
            photo.photographer?.trim() ||
            photo.alt
              ?.trim()
              .split(/\s+/)
              .slice(0, 4)
              .join(' ') ||
            `Photo ${photo.id}`,
          src: photo.src.medium ?? photo.src.large ?? photo.src.original ?? '',
        }))
        .filter((photo) => photo.src.length > 0)

      setWebSearchResults(results)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Web search failed.'
      setWebSearchError(message)
      setWebSearchResults([])
    } finally {
      setIsWebSearchLoading(false)
    }
  }

  const normalizedAddMenuSearchQuery = addMenuSearchQuery.trim().toLowerCase()
  const filteredReferenceThumbnails = referenceThumbnails.filter((thumbnail) =>
    thumbnail.name.toLowerCase().includes(normalizedAddMenuSearchQuery),
  )

  const getCurrentRenderBlurPx = () => {
    if (renderCycleStartedAtRef.current === null) {
      return renderBlurMinPx
    }

    const elapsedMs = (performance.now() - renderCycleStartedAtRef.current) % renderBlurCycleMs
    const halfCycleMs = renderBlurCycleMs / 2
    const travelProgress = elapsedMs <= halfCycleMs ? elapsedMs / halfCycleMs : (renderBlurCycleMs - elapsedMs) / halfCycleMs
    return renderBlurMinPx + (renderBlurMaxPx - renderBlurMinPx) * travelProgress
  }

  const handleRender = async () => {
    const promptParts = [
      composerInput.trim(),
      ...commentAnnotations.map((comment) => comment.text.trim()).filter((text) => text.length > 0),
    ].filter((part) => part.length > 0)
    if (promptParts.length === 0) {
      return
    }

    const reveApiKey = (import.meta.env.VITE_REVE_API_KEY as string | undefined)?.trim()
    if (!reveApiKey) {
      setReveRenderError('Missing VITE_REVE_API_KEY.')
      return
    }

    const prompt = `Base scene: ${imageDescription}\n\nEdit request: ${promptParts.join('\n')}`

    setIsReveRendering(true)
    setReveRenderError(null)
    renderCycleStartedAtRef.current = performance.now()
    if (renderRevealTimeoutRef.current !== null) {
      window.clearTimeout(renderRevealTimeoutRef.current)
      renderRevealTimeoutRef.current = null
    }
    setRenderRevealTransition(null)

    try {
      const response = await fetch('https://api.reve.com/v1/image/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${reveApiKey}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: '16:9',
          version: 'latest',
        }),
      })

      const payload = (await response.json()) as {
        image?: string
        content_violation?: boolean
        message?: string
        error_code?: string
      }

      if (!response.ok) {
        throw new Error(payload.message || payload.error_code || `Reve request failed (${response.status})`)
      }

      if (payload.content_violation) {
        throw new Error('Reve flagged this request for content policy.')
      }

      if (!payload.image) {
        throw new Error('Reve response did not include image data.')
      }

      const nextImageSrc = `data:image/png;base64,${payload.image}`
      const blurAtRevealPx = getCurrentRenderBlurPx()
      setRenderRevealTransition({
        previousImageSrc: displayImageSrc,
        nextImageSrc,
        startingBlurPx: blurAtRevealPx,
      })
      setRenderHistory((previous) => {
        const timestamp = Date.now()
        const nextRenderItem = { id: `${timestamp}-${previous.length}`, src: nextImageSrc }
        if (previous.length === 0) {
          return [
            { id: `${timestamp}-base`, src: displayImageSrc },
            nextRenderItem,
          ]
        }
        return [...previous, nextRenderItem]
      })
      renderRevealTimeoutRef.current = window.setTimeout(() => {
        setRenderRevealTransition(null)
        renderRevealTimeoutRef.current = null
      }, renderRevealCrossfadeMs + renderRevealSharpenMs)

      setDisplayImageSrc(nextImageSrc)
      setSourceImageLoaded(false)
      setComposerInput('')
      setCommentAnnotations([])
      setActiveCommentId(null)
      setIsDrawingCommentStroke(false)
      setDraftCommentStrokePoints([])
      setDraftCommentBoxStart(null)
      setDraftCommentBoxEnd(null)
      commentBoxModeRef.current = false
      draftCommentStrokePointsRef.current = []
      commentPointerIdRef.current = null
      commentStrokeStartPointRef.current = null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reve render failed.'
      setReveRenderError(message)
    } finally {
      setIsReveRendering(false)
      renderCycleStartedAtRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (renderRevealTimeoutRef.current !== null) {
        window.clearTimeout(renderRevealTimeoutRef.current)
      }
    }
  }, [])

  const toggleBottomLeftMenu = (menu: Exclude<BottomLeftMenu, null>) => {
    setActiveBottomLeftMenu((previous) => (previous === menu ? null : menu))
  }

  const handleImageMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (isInteractionMenuOpen) {
      return
    }

    if (selectedTool === 'commentDraw') {
      setCommentCursorPosition({ x: event.clientX, y: event.clientY })
      setShowCommentCursorHint(true)
    } else {
      setShowCommentCursorHint(false)
    }

    if (selectedTool !== 'select') {
      setHoveredObjectName(null)
      return
    }

    const imageFrameBounds = event.currentTarget.getBoundingClientRect()
    const hoveredObject = getSmallestObjectAtClientPoint(event.clientX, event.clientY, imageFrameBounds)

    setHoveredObjectName(hoveredObject?.name ?? null)
    setHoverTooltipPosition({ x: event.clientX, y: event.clientY })
    setHoverCornerMarkerSize((imageFrameBounds.width / sourceImageSize.width) * 36)
  }

  const handleImageClick = (event: MouseEvent<HTMLDivElement>) => {
    if (isInteractionMenuOpen) {
      return
    }

    if (selectedTool !== 'select') {
      closeObjectPrompt()
      return
    }

    const imageFrameBounds = event.currentTarget.getBoundingClientRect()
    const clickedObject = getSmallestObjectAtClientPoint(event.clientX, event.clientY, imageFrameBounds)

    if (!clickedObject) {
      closeObjectPrompt()
      return
    }

    openObjectPrompt(clickedObject.name, imageFrameBounds)
  }

  const handleImagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isInteractionMenuOpen) {
      return
    }

    if (selectedTool !== 'commentDraw') {
      return
    }

    event.preventDefault()

    const imageFrameBounds = event.currentTarget.getBoundingClientRect()
    const sourcePoint = clientPointToSource(event.clientX, event.clientY, imageFrameBounds)
    commentPointerIdRef.current = event.pointerId

    if (event.altKey) {
      commentBoxModeRef.current = true
      setDraftCommentBoxStart(sourcePoint)
      setDraftCommentBoxEnd(sourcePoint)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    commentStrokeStartPointRef.current = sourcePoint
    draftCommentStrokePointsRef.current = [sourcePoint]
    setIsDrawingCommentStroke(true)
    setDraftCommentStrokePoints(draftCommentStrokePointsRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleImagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isInteractionMenuOpen) {
      return
    }

    if (selectedTool !== 'commentDraw' || commentPointerIdRef.current !== event.pointerId) {
      return
    }

    const imageFrameBounds = event.currentTarget.getBoundingClientRect()
    const nextPoint = clientPointToSource(event.clientX, event.clientY, imageFrameBounds)

    if (commentBoxModeRef.current) {
      setDraftCommentBoxEnd(nextPoint)
      return
    }

    draftCommentStrokePointsRef.current = [...draftCommentStrokePointsRef.current, nextPoint]
    setDraftCommentStrokePoints(draftCommentStrokePointsRef.current)
  }

  const handleImagePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (isInteractionMenuOpen) {
      return
    }

    if (selectedTool !== 'commentDraw' || commentPointerIdRef.current !== event.pointerId) {
      return
    }

    const imageFrameBounds = event.currentTarget.getBoundingClientRect()
    const endPoint = clientPointToSource(event.clientX, event.clientY, imageFrameBounds)

    if (commentBoxModeRef.current) {
      const start = draftCommentBoxStart ?? endPoint
      const rectPoints = getRectStrokePoints(start, endPoint)
      const movement = Math.hypot(endPoint.x - start.x, endPoint.y - start.y)
      if (movement >= 12) {
        createCommentAnnotation('stroke', rectPoints, imageFrameBounds)
      }
      commentBoxModeRef.current = false
      setDraftCommentBoxStart(null)
      setDraftCommentBoxEnd(null)
      commentPointerIdRef.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }

    const startPoint = commentStrokeStartPointRef.current ?? endPoint
    const movement = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y)
    const completedStrokePoints = [...draftCommentStrokePointsRef.current, endPoint]
    const shouldCreateStroke = movement >= 12

    if (shouldCreateStroke && completedStrokePoints.length > 1) {
      createCommentAnnotation('stroke', completedStrokePoints, imageFrameBounds)
    } else {
      createCommentAnnotation('point', [startPoint], imageFrameBounds)
    }

    setIsDrawingCommentStroke(false)
    setDraftCommentStrokePoints([])
    commentPointerIdRef.current = null
    commentStrokeStartPointRef.current = null
    draftCommentStrokePointsRef.current = []
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleImagePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (isInteractionMenuOpen) {
      return
    }

    if (commentPointerIdRef.current !== event.pointerId) {
      return
    }

    setIsDrawingCommentStroke(false)
    setDraftCommentStrokePoints([])
    commentBoxModeRef.current = false
    setDraftCommentBoxStart(null)
    setDraftCommentBoxEnd(null)
    commentPointerIdRef.current = null
    commentStrokeStartPointRef.current = null
    draftCommentStrokePointsRef.current = []
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleImageMouseLeave = () => {
    setHoveredObjectName(null)
    setShowCommentCursorHint(false)
  }

  const selectedImageObject = activeObjectPromptName
    ? imageObjects.find((imageObject) => imageObject.name === activeObjectPromptName) ?? null
    : null
  const transientHighlightedObjectName = hoveredObjectListName ?? hoveredObjectName
  const transientHighlightedObject = transientHighlightedObjectName
    ? imageObjects.find((imageObject) => imageObject.name === transientHighlightedObjectName) ?? null
    : null
  const displayedObjectPrompt = displayedObjectPromptName
    ? imageObjects.find((imageObject) => imageObject.name === displayedObjectPromptName) ?? null
    : null
  const displayedObjectPromptText = displayedObjectPrompt
    ? (objectPromptTexts[displayedObjectPrompt.name] ?? getObjectPromptText(displayedObjectPrompt.name))
    : ''
  const activeComment = activeCommentId ? commentAnnotations.find((comment) => comment.id === activeCommentId) ?? null : null
  activeCommentRef.current = activeComment

  useLayoutEffect(() => {
    if (activeBottomLeftMenu !== 'info' || !infoTextareaRef.current) {
      return
    }

    infoTextareaRef.current.style.height = '0px'
    infoTextareaRef.current.style.height = `${infoTextareaRef.current.scrollHeight}px`
  }, [infoText, activeBottomLeftMenu])

  useLayoutEffect(() => {
    if (!displayedObjectPrompt || !objectPromptTextareaRef.current) {
      return
    }

    objectPromptTextareaRef.current.style.height = '0px'
    objectPromptTextareaRef.current.style.height = `${objectPromptTextareaRef.current.scrollHeight}px`
  }, [displayedObjectPrompt, displayedObjectPromptText])

  useLayoutEffect(() => {
    if (!activeComment || !commentTextareaRef.current || !imageFrameRef.current) {
      return
    }

    commentTextareaRef.current.style.height = '0px'
    commentTextareaRef.current.style.height = `${commentTextareaRef.current.scrollHeight}px`

    const imageFrameBounds = imageFrameRef.current.getBoundingClientRect()
    const panelHeight = Math.max(130, commentTextareaRef.current.scrollHeight + 30)
    const nextPanelPosition = getCommentPanelPosition(getCommentAnchorPoint(activeComment), imageFrameBounds, panelHeight)
    setCommentPanelPosition(nextPanelPosition)
    setCommentAnnotations((previous) =>
      previous.map((comment) => (comment.id === activeComment.id ? { ...comment, panelPosition: nextPanelPosition } : comment)),
    )
  }, [activeComment?.id, activeComment?.text])

  useEffect(() => {
    if (!activeComment || !commentTextareaRef.current) {
      return
    }

    commentTextareaRef.current.focus()
    commentTextareaRef.current.select()
  }, [activeComment?.id])

  useEffect(() => {
    if (activeBottomLeftMenu !== 'objects') {
      setHoveredObjectListName(null)
    }
  }, [activeBottomLeftMenu])

  useEffect(() => {
    if (selectedTool !== 'select') {
      setHoveredObjectName(null)
      closeObjectPrompt()
    }

    if (selectedTool !== 'commentDraw') {
      setShowCommentCursorHint(false)
      setIsDrawingCommentStroke(false)
      setDraftCommentStrokePoints([])
      setDraftCommentBoxStart(null)
      setDraftCommentBoxEnd(null)
      commentBoxModeRef.current = false
      draftCommentStrokePointsRef.current = []
      commentPointerIdRef.current = null
      commentStrokeStartPointRef.current = null
      collapseActiveCommentPanel()
    }
  }, [selectedTool])

  useEffect(() => {
    setToolInstructionFadedOut(false)
    if (toolInstructionTimeoutRef.current !== null) {
      clearTimeout(toolInstructionTimeoutRef.current)
      toolInstructionTimeoutRef.current = null
    }
    toolInstructionTimeoutRef.current = setTimeout(() => {
      setToolInstructionFadedOut(true)
      toolInstructionTimeoutRef.current = null
    }, 5000)
    return () => {
      if (toolInstructionTimeoutRef.current !== null) {
        clearTimeout(toolInstructionTimeoutRef.current)
      }
    }
  }, [selectedTool])

  useLayoutEffect(() => {
    if (!displayedObjectPrompt || !imageFrameRef.current || !objectPromptPanelRef.current) {
      return
    }

    const imageFrameBounds = imageFrameRef.current.getBoundingClientRect()
    const measuredPanelHeight = objectPromptPanelRef.current.offsetHeight
    const nextPosition = getObjectPromptPanelPosition(displayedObjectPrompt, imageFrameBounds, measuredPanelHeight)
    const objectCenterX =
      imageFrameBounds.left + ((displayedObjectPrompt.x + displayedObjectPrompt.width / 2) / sourceImageSize.width) * imageFrameBounds.width
    const objectCenterY =
      imageFrameBounds.top + ((displayedObjectPrompt.y + displayedObjectPrompt.height / 2) / sourceImageSize.height) * imageFrameBounds.height
    const panelCenterX = nextPosition.left + 100
    const panelCenterY = nextPosition.top + measuredPanelHeight / 2
    const nextFromOffset = clampVectorMagnitude(objectCenterX - panelCenterX, objectCenterY - panelCenterY, 100)

    setObjectPromptFromOffset(nextFromOffset)
    setObjectPromptPanelPosition((previous) =>
      previous.left === nextPosition.left && previous.top === nextPosition.top ? previous : nextPosition,
    )
  }, [displayedObjectPrompt, objectPromptAnimationKey])

  useEffect(() => {
    if (activeBottomLeftMenu === null) {
      return
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Node)) {
        return
      }

      if (!bottomLeftContainerRef.current?.contains(eventTarget)) {
        setActiveBottomLeftMenu(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [activeBottomLeftMenu])

  useEffect(() => {
    if (!displayedObjectPrompt) {
      return
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Node)) {
        return
      }

      if (!objectPromptPanelRef.current?.contains(eventTarget)) {
        closeObjectPrompt()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [displayedObjectPrompt])

  useEffect(() => {
    if (!isComposerAddMenuOpen) {
      return
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Node)) {
        return
      }

      if (addMenuRef.current?.contains(eventTarget)) {
        return
      }

      if (eventTarget instanceof Element && eventTarget.closest('[data-add-menu-trigger="true"]')) {
        return
      }

      if (!(eventTarget instanceof Element)) {
        return
      }

      if (!eventTarget.closest('.composer-add-menu')) {
        setIsComposerAddMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isComposerAddMenuOpen])

  useEffect(() => {
    if (!isPendingEditsMenuOpen) {
      return
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Node)) {
        return
      }

      if (pendingEditsMenuRef.current?.contains(eventTarget)) {
        return
      }

      if (eventTarget instanceof Element && eventTarget.closest('[data-pending-edits-trigger="true"]')) {
        return
      }

      setIsPendingEditsMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [isPendingEditsMenuOpen])

  useEffect(() => {
    if (pendingEditCount > 0) {
      return
    }

    setIsPendingEditsMenuOpen(false)
  }, [pendingEditCount])

  useEffect(() => {
    if (!sourceImageRef.current || pendingEdits.length === 0) {
      setPendingEditThumbnailSrcById({})
      return
    }

    const sourceImageElement = sourceImageRef.current
    if (!sourceImageElement.complete || sourceImageElement.naturalWidth === 0 || sourceImageElement.naturalHeight === 0) {
      return
    }

    const thumbnailMap: Record<string, string> = {}

    pendingEdits.forEach((pendingEdit) => {
      const { annotation } = pendingEdit
      const anchorPoint = getCommentAnchorPoint(annotation)
      const halfSize = pendingEditThumbnailSize / 2
      const cropX = Math.round(Math.max(0, Math.min(sourceImageSize.width - pendingEditThumbnailSize, anchorPoint.x - halfSize)))
      const cropY = Math.round(Math.max(0, Math.min(sourceImageSize.height - pendingEditThumbnailSize, anchorPoint.y - halfSize)))

      const thumbnailCanvas = document.createElement('canvas')
      thumbnailCanvas.width = pendingEditThumbnailSize
      thumbnailCanvas.height = pendingEditThumbnailSize
      const thumbnailContext = thumbnailCanvas.getContext('2d')
      if (!thumbnailContext) {
        return
      }

      thumbnailContext.drawImage(
        sourceImageElement,
        cropX,
        cropY,
        pendingEditThumbnailSize,
        pendingEditThumbnailSize,
        0,
        0,
        pendingEditThumbnailSize,
        pendingEditThumbnailSize,
      )

      if (annotation.kind === 'stroke' && annotation.strokePoints.length > 1) {
        thumbnailContext.strokeStyle = '#ff0000'
        thumbnailContext.lineWidth = 2
        thumbnailContext.lineCap = 'round'
        thumbnailContext.lineJoin = 'round'
        thumbnailContext.beginPath()
        annotation.strokePoints.forEach((point, index) => {
          const localX = point.x - cropX
          const localY = point.y - cropY
          if (index === 0) {
            thumbnailContext.moveTo(localX, localY)
          } else {
            thumbnailContext.lineTo(localX, localY)
          }
        })
        thumbnailContext.stroke()
      }

      thumbnailMap[pendingEdit.id] = thumbnailCanvas.toDataURL('image/png')
    })

    setPendingEditThumbnailSrcById(thumbnailMap)
  }, [pendingEdits, displayImageSrc, sourceImageLoaded])

  useLayoutEffect(() => {
    if (!isComposerAddMenuOpen || !addMenuRef.current) {
      return
    }

    const updateClampedAddMenuPosition = () => {
      const menuBounds = addMenuRef.current?.getBoundingClientRect()
      if (!menuBounds) {
        return
      }
      const clampedPosition = clampAddMenuPosition(
        addMenuPosition,
        Math.ceil(menuBounds.width),
        Math.ceil(menuBounds.height),
      )
      if (clampedPosition.left !== addMenuPosition.left || clampedPosition.top !== addMenuPosition.top) {
        setAddMenuPosition(clampedPosition)
      }
    }

    updateClampedAddMenuPosition()
    window.addEventListener('resize', updateClampedAddMenuPosition)
    return () => {
      window.removeEventListener('resize', updateClampedAddMenuPosition)
    }
  }, [
    isComposerAddMenuOpen,
    addMenuPosition,
    isAddMenuReferenceBrowserOpen,
    addMenuSourceTab,
    addMenuSearchQuery,
    webSearchResults,
    isWebSearchLoading,
    webSearchError,
    hasWebSearchPerformed,
  ])

  useEffect(() => {
    if (!activeComment) {
      return
    }

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const eventTarget = event.target
      if (!(eventTarget instanceof Node)) {
        return
      }
      if (commentPanelRef.current?.contains(eventTarget)) {
        return
      }
      if (commentLayerRef.current?.contains(eventTarget)) {
        return
      }
      if (addMenuRef.current?.contains(eventTarget)) {
        return
      }
      if (eventTarget instanceof Element && eventTarget.closest('[data-add-menu-trigger="true"]')) {
        return
      }
      collapseActiveCommentPanel()
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [activeComment?.id])

  useEffect(() => {
    return () => {
      if (objectPromptCloseTimeoutRef.current !== null) {
        window.clearTimeout(objectPromptCloseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isToggleShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o'

      if (!isToggleShortcut) {
        return
      }

      event.preventDefault()
      setShowObjectOverlays((previous) => !previous)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      if (displayedObjectPromptName !== null) {
        event.preventDefault()
        closeObjectPrompt()
        return
      }

      if (isComposerAddMenuOpen) {
        event.preventDefault()
        setIsComposerAddMenuOpen(false)
        return
      }

      if (isPendingEditsMenuOpen) {
        event.preventDefault()
        setIsPendingEditsMenuOpen(false)
        return
      }

      if (activeCommentId !== null) {
        event.preventDefault()
        const activeCommentForEscape = activeCommentRef.current
        if (activeCommentForEscape && activeCommentForEscape.kind === 'point' && activeCommentForEscape.text.trim().length === 0) {
          setCommentAnnotations((previous) => previous.filter((comment) => comment.id !== activeCommentForEscape.id))
          setActiveCommentId((previous) => (previous === activeCommentForEscape.id ? null : previous))
        } else {
          collapseActiveCommentPanel()
        }
        return
      }

      if (activeBottomLeftMenu !== null) {
        event.preventDefault()
        setActiveBottomLeftMenu(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    displayedObjectPromptName,
    isComposerAddMenuOpen,
    isPendingEditsMenuOpen,
    activeCommentId,
    activeBottomLeftMenu,
    closeObjectPrompt,
    collapseActiveCommentPanel,
  ])

  return (
    <>
      <div className="top-overlay-bar" aria-hidden="true" />
      <header className="top-right-meta" aria-label="Project breadcrumb">
        <img className="reve-logo" src={reveLogo} alt="Reve logo" />
        <span className="meta-text light meta-link">My Work</span>
        <span className="meta-text separator">/</span>
        <span className="meta-text light meta-link">Tour du Mont Blanc</span>
        <span className="meta-text separator">/</span>
        <span className="meta-text heavy">Courmayeur Afternoon</span>
      </header>
      <nav className="top-right-actions" aria-label="Page actions">
        <button className="glyph-button" type="button" aria-label="Favorite">
          <img className="glyph-icon" src={favOffGlyph} alt="" />
        </button>
        <button className="glyph-button" type="button" aria-label="Share">
          <img className="glyph-icon" src={shareGlyph} alt="" />
        </button>
        <button className="glyph-button" type="button" aria-label="More">
          <img className="glyph-icon" src={moreGlyph} alt="" />
        </button>
      </nav>
      <p
        className={`tool-instruction${toolInstructionFadedOut ? ' tool-instruction--faded' : ''}`}
        aria-live="polite"
      >
        {TOOL_INSTRUCTIONS[selectedTool]}
      </p>
      <nav className="tool-palette" style={{ bottom: `${controlsBottomPx}px` }} aria-label="Tools">
        <button
          className={`tool-button${selectedTool === 'select' ? ' selected' : ''}`}
          type="button"
          aria-label="Move"
          aria-pressed={selectedTool === 'select'}
          onClick={() => setSelectedTool('select')}
        >
          <svg className="tool-glyph-svg tool-glyph-move" viewBox="0 0 12 16" aria-hidden="true">
            <path
              d="M5.29102 11.2236L2.00391 14.502C1.78711 14.7188 1.56152 14.8564 1.32715 14.915C1.09277 14.9795 0.875977 14.9795 0.676758 14.915C0.477539 14.8506 0.313477 14.7305 0.18457 14.5547C0.0615234 14.3789 0 14.1621 0 13.9043V1.23926C0 0.952148 0.0644531 0.711914 0.193359 0.518555C0.328125 0.325195 0.498047 0.19043 0.703125 0.114258C0.914062 0.0380859 1.13379 0.0263672 1.3623 0.0791016C1.59082 0.125977 1.80469 0.249023 2.00391 0.448242L10.9336 9.37793C11.1152 9.56543 11.2236 9.76465 11.2588 9.97559C11.2939 10.1865 11.2617 10.3887 11.1621 10.582C11.0684 10.7695 10.916 10.9248 10.7051 11.0479C10.5 11.165 10.2422 11.2236 9.93164 11.2236H5.29102Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          className={`tool-button${selectedTool === 'commentDraw' ? ' selected' : ''}`}
          type="button"
          aria-label="Comment & Draw"
          aria-pressed={selectedTool === 'commentDraw'}
          onClick={() => setSelectedTool('commentDraw')}
        >
          <svg className="tool-glyph-svg tool-glyph-comment" viewBox="0 0 16 14" aria-hidden="true">
            <path
              d="M7.05282 1.9903C7.44392 1.9903 7.8235 2.01233 8.19159 2.05601C7.86948 2.42428 7.74929 2.84115 7.71882 3.18393C7.50183 3.16741 7.27985 3.15875 7.05282 3.15875C6.18606 3.15875 5.39252 3.27921 4.6722 3.52012C3.95188 3.75702 3.32852 4.0923 2.80213 4.52595C2.27574 4.9596 1.86809 5.47155 1.57917 6.06179C1.2942 6.65204 1.15172 7.29448 1.15172 7.98913C1.15172 8.44687 1.21307 8.88253 1.33576 9.2961C1.46241 9.70967 1.64447 10.0891 1.88194 10.4344C2.07192 10.7235 2.21242 10.9926 2.30345 11.2415C2.39448 11.4905 2.43999 11.7294 2.43999 11.9582C2.43999 12.0907 2.42218 12.2092 2.38656 12.3136C2.3549 12.418 2.31532 12.5204 2.26783 12.6208C2.39843 12.5886 2.52508 12.5445 2.64778 12.4882C2.77443 12.432 2.89118 12.3698 2.99804 12.3015C3.18406 12.1971 3.3582 12.1369 3.52047 12.1208C3.6867 12.1048 3.86876 12.1409 4.06665 12.2293C4.4941 12.426 4.95716 12.5766 5.45585 12.681C5.95849 12.7814 6.49081 12.8316 7.05282 12.8316C7.91958 12.8316 8.71313 12.7111 9.43345 12.4702C10.1577 12.2293 10.7831 11.892 11.3095 11.4583C11.8358 11.0247 12.2415 10.5127 12.5265 9.92248C12.7558 9.44751 12.8913 8.9373 12.9361 8.39212C13.3092 8.34306 13.6369 8.1864 13.8979 7.97106L13.8989 7.97215C13.9176 7.95704 13.9355 7.94128 13.9535 7.92561C13.9571 7.92238 13.9606 7.91902 13.9642 7.91576C14.015 7.87071 14.0622 7.82265 14.1073 7.7734C14.1097 7.84483 14.1116 7.91672 14.1116 7.98913C14.1116 8.86044 13.9355 9.66149 13.5832 10.3923C13.2349 11.1231 12.7442 11.7595 12.1109 12.3015C11.4777 12.8396 10.7316 13.2572 9.87277 13.5543C9.01392 13.8514 8.07394 14 7.05282 14C5.75466 14 4.58711 13.7691 3.55016 13.3074C3.23749 13.5242 2.88327 13.6928 2.48749 13.8133C2.0917 13.9378 1.70186 14 1.31795 14C1.10819 14 0.945917 13.9418 0.831141 13.8253C0.720322 13.7089 0.666892 13.5684 0.670849 13.4037C0.678765 13.2431 0.7599 13.0946 0.914255 12.958C1.05674 12.8255 1.15568 12.691 1.21109 12.5545C1.27046 12.418 1.30014 12.2654 1.30014 12.0968C1.30014 11.9482 1.26848 11.7936 1.20515 11.633C1.14183 11.4684 1.0409 11.2776 0.902381 11.0608C0.720322 10.7838 0.560031 10.4866 0.421507 10.1694C0.286941 9.85222 0.182059 9.51293 0.106861 9.15155C0.0356203 8.78616 0 8.39869 0 7.98913C0 7.11781 0.174144 6.31676 0.522431 5.58598C0.874677 4.85119 1.36742 4.21477 2.00067 3.67672C2.63392 3.13867 3.37997 2.72309 4.23882 2.42997C5.09766 2.13686 6.03567 1.9903 7.05282 1.9903Z"
              fill="currentColor"
            />
            <path
              d="M12.6927 0C12.8404 4.47267e-05 12.9312 0.089613 12.9653 0.268294C13.0448 0.781192 13.1385 1.20482 13.2464 1.53913C13.3544 1.86772 13.5026 2.13292 13.6901 2.3347C13.8776 2.53069 14.1332 2.68645 14.457 2.80175C14.7866 2.91129 15.2157 3.00386 15.7442 3.07881C15.9147 3.10187 16 3.19987 16 3.37283C16 3.53419 15.9146 3.62629 15.7442 3.64934C15.21 3.73005 14.7809 3.82507 14.457 3.93461C14.1331 4.04415 13.8776 4.19743 13.6901 4.39345C13.5083 4.58942 13.366 4.85721 13.2637 5.19723C13.1614 5.53162 13.0619 5.95849 12.9653 6.47738C12.9539 6.5523 12.9201 6.61304 12.8633 6.65916C12.8362 6.68352 12.8071 6.70023 12.7769 6.71172L12.7758 6.71282L12.7753 6.71227C12.7488 6.72212 12.7216 6.72814 12.6927 6.72815C12.6076 6.72815 12.5393 6.70517 12.4882 6.65916C12.437 6.61304 12.4086 6.54933 12.4029 6.46861C12.3176 5.94977 12.221 5.52584 12.1131 5.19723C12.0108 4.86292 11.8626 4.59765 11.6694 4.40166C11.6438 4.37405 11.6167 4.3475 11.5885 4.32172C11.4105 4.15922 11.182 4.03291 10.9025 3.94337C10.5786 3.83384 10.1553 3.73581 9.6326 3.64934C9.49316 3.62652 9.40963 3.56382 9.38056 3.46154C9.37804 3.45304 9.37583 3.44431 9.37408 3.43525C9.37319 3.43038 9.37205 3.4255 9.37138 3.42047C9.36924 3.40535 9.36815 3.38948 9.36814 3.37283C9.36814 3.3306 9.37329 3.2928 9.3838 3.25949C9.38481 3.25628 9.38646 3.25332 9.38757 3.25019C9.3916 3.23884 9.39629 3.22813 9.40161 3.21788C9.40495 3.21143 9.40855 3.20528 9.4124 3.19926C9.417 3.19208 9.42165 3.18503 9.42697 3.17846C9.43102 3.17346 9.43546 3.16886 9.43992 3.16422C9.44693 3.15695 9.45456 3.15036 9.46259 3.14396C9.4674 3.14014 9.47199 3.13598 9.47716 3.13247C9.48449 3.12749 9.49231 3.12312 9.50037 3.11878C9.50688 3.11528 9.51336 3.11147 9.52034 3.10837C9.53587 3.1015 9.55262 3.09571 9.57053 3.09085L9.6326 3.07881C9.75901 3.06088 9.8793 3.04132 9.99366 3.02131C10.219 2.9821 10.4206 2.93789 10.5992 2.891C10.6761 2.87072 10.749 2.85076 10.8172 2.82913C10.8462 2.81996 10.8751 2.81118 10.9025 2.80175C11.2264 2.68645 11.4819 2.53071 11.6694 2.3347C11.857 2.13868 12.0021 1.87651 12.1044 1.54789C12.2067 1.21353 12.3063 0.784097 12.4029 0.259533C12.4313 0.0865729 12.5279 0 12.6927 0Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <button
          className={`tool-button${selectedTool === 'reframe' ? ' selected' : ''}`}
          type="button"
          aria-label="Reframe"
          aria-pressed={selectedTool === 'reframe'}
          onClick={() => setSelectedTool('reframe')}
        >
          <svg className="tool-glyph-svg tool-glyph-reframe" viewBox="0 0 18 22" aria-hidden="true">
            <path
              d="M12.7705 3.55957C12.7705 3.84082 12.6768 4.01367 12.4893 4.07812C12.3076 4.14258 12.1084 4.0957 11.8916 3.9375L9.8877 2.47852C9.71777 2.34961 9.63281 2.2207 9.63281 2.0918C9.63867 1.95703 9.72363 1.82812 9.8877 1.70508L11.8916 0.237305C12.1084 0.0791016 12.3076 0.0322266 12.4893 0.0966797C12.6768 0.161133 12.7705 0.339844 12.7705 0.632812V3.55957ZM11.5312 1.66992H12.9287C13.667 1.66992 14.3145 1.82227 14.8711 2.12695C15.4277 2.43164 15.8584 2.8623 16.1631 3.41895C16.4678 3.96973 16.6201 4.61719 16.6201 5.36133V6.43359C16.6201 6.56836 16.5703 6.68848 16.4707 6.79395C16.3711 6.89355 16.2568 6.94336 16.1279 6.94336C15.9932 6.94336 15.873 6.89355 15.7676 6.79395C15.668 6.68848 15.6182 6.56836 15.6182 6.43359V5.36133C15.6182 4.81055 15.5068 4.32715 15.2842 3.91113C15.0615 3.49512 14.748 3.17285 14.3438 2.94434C13.9395 2.70996 13.4648 2.59277 12.9199 2.59277H11.5312C11.4023 2.59277 11.2939 2.54883 11.2061 2.46094C11.1182 2.36719 11.0742 2.25586 11.0742 2.12695C11.0742 1.99805 11.1182 1.88965 11.2061 1.80176C11.2939 1.71387 11.4023 1.66992 11.5312 1.66992ZM4.48242 17.9648C4.48242 17.6836 4.57324 17.5107 4.75488 17.4463C4.94238 17.3818 5.14453 17.4316 5.36133 17.5957L7.36523 19.0547C7.53516 19.1777 7.61719 19.3066 7.61133 19.4414C7.61133 19.5762 7.5293 19.7051 7.36523 19.8281L5.36133 21.2871C5.14453 21.4512 4.94238 21.501 4.75488 21.4365C4.57324 21.3721 4.48242 21.1934 4.48242 20.9004V17.9648ZM5.72168 19.8633H4.32422C3.58594 19.8633 2.93848 19.708 2.38184 19.3975C1.8252 19.0928 1.39453 18.6621 1.08984 18.1055C0.785156 17.5547 0.632812 16.9102 0.632812 16.1719V15.0996C0.632812 14.959 0.682617 14.8389 0.782227 14.7393C0.881836 14.6396 0.996094 14.5898 1.125 14.5898C1.25977 14.5898 1.37695 14.6396 1.47656 14.7393C1.58203 14.8389 1.63477 14.959 1.63477 15.0996V16.1631C1.63477 16.7197 1.74609 17.2061 1.96875 17.6221C2.19141 18.0381 2.50488 18.3604 2.90918 18.5889C3.31348 18.8232 3.78809 18.9404 4.33301 18.9404H5.72168C5.85059 18.9404 5.95898 18.9844 6.04688 19.0723C6.13477 19.166 6.17871 19.2773 6.17871 19.4062C6.17871 19.5293 6.13477 19.6348 6.04688 19.7227C5.95898 19.8164 5.85059 19.8633 5.72168 19.8633ZM17.2002 14.1328C17.2002 14.332 17.1357 14.4932 17.0068 14.6162C16.8779 14.7334 16.7109 14.792 16.5059 14.792H5.18555C4.96875 14.792 4.7959 14.7305 4.66699 14.6074C4.54395 14.4785 4.48242 14.3086 4.48242 14.0977V2.94434C4.48242 2.72168 4.54688 2.54297 4.67578 2.4082C4.80469 2.27344 4.97754 2.20605 5.19434 2.20605C5.40527 2.20605 5.5752 2.27344 5.7041 2.4082C5.83301 2.54297 5.89746 2.72168 5.89746 2.94434V13.21C5.89746 13.3799 5.98242 13.4648 6.15234 13.4648H16.5059C16.7109 13.4648 16.8779 13.5264 17.0068 13.6494C17.1357 13.7725 17.2002 13.9336 17.2002 14.1328ZM0 7.34766C0 7.14844 0.0615234 6.9873 0.18457 6.86426C0.313477 6.74121 0.480469 6.67969 0.685547 6.67969H12.0674C12.2783 6.67969 12.4482 6.74414 12.5771 6.87305C12.7061 7.00195 12.7705 7.17188 12.7705 7.38281V18.5889C12.7705 18.8057 12.7031 18.9814 12.5684 19.1162C12.4395 19.2568 12.2695 19.3271 12.0586 19.3271C11.8477 19.3271 11.6777 19.2568 11.5488 19.1162C11.4199 18.9814 11.3555 18.8057 11.3555 18.5889V8.26172C11.3555 8.0918 11.2705 8.00684 11.1006 8.00684H0.685547C0.480469 8.00684 0.313477 7.94824 0.18457 7.83105C0.0615234 7.70801 0 7.54688 0 7.34766Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </nav>
      <div ref={bottomLeftContainerRef}>
        {activeBottomLeftMenu !== null && (
          <section
            ref={bottomLeftPanelRef}
            className={`bottom-left-panel${
              activeBottomLeftMenu === 'info'
                ? ' bottom-left-panel--info'
                : activeBottomLeftMenu === 'objects'
                  ? ' bottom-left-panel--objects'
                  : activeBottomLeftMenu === 'effects'
                    ? ' bottom-left-panel--effects'
                    : activeBottomLeftMenu === 'adjust'
                      ? ` bottom-left-panel--adjust${adjustSliderDraggingId != null ? ' bottom-left-panel--adjust-dragging' : ''}`
                      : ''
            }`}
            aria-label={`${activeBottomLeftMenu} menu`}
          >
            {activeBottomLeftMenu === 'info' && (
              <textarea
                ref={infoTextareaRef}
                className="menu-description-input"
                value={infoText}
                onChange={(event) => setInfoText(event.target.value)}
              />
            )}

            {activeBottomLeftMenu === 'objects' && (
              <>
                <div className="objects-add-buttons">
                  <button className="objects-add-button" type="button" aria-label="Add Text">
                    <img className="objects-add-button-glyph" src={textGlyph} alt="" aria-hidden="true" />
                    <span className="objects-add-button-label">Add Text</span>
                  </button>
                  <button className="objects-add-button" type="button" aria-label="Add Object">
                    <img className="objects-add-button-glyph" src={objectGlyph} alt="" aria-hidden="true" />
                    <span className="objects-add-button-label">Add Object</span>
                  </button>
                </div>
                <div className="objects-list">
                {objectThumbnailsWithObjectName.map((objectThumbnail) => (
                  <button
                    key={objectThumbnail.name}
                    className="object-row"
                    type="button"
                    onMouseEnter={() => setHoveredObjectListName(objectThumbnail.objectName)}
                    onMouseLeave={() => setHoveredObjectListName(null)}
                  >
                    <img className="object-thumb" src={objectThumbnail.src} alt={objectThumbnail.name} />
                    <span className="object-name">{objectThumbnail.name}</span>
                    <span className="object-row-trash-wrap" aria-hidden="true">
                      <img className="object-row-trash" src={trashGlyph} alt="Delete" aria-hidden="true" />
                    </span>
                  </button>
                ))}
                </div>
              </>
            )}

            {activeBottomLeftMenu === 'adjust' && (
              <>
                <div
                  className={`adjust-panel-bg${adjustSliderDraggingId != null ? ' adjust-panel-bg--dragging' : ''}`}
                  aria-hidden="true"
                />
                <div ref={adjustContentRef} className="adjust-content">
                <div className="adjust-action-buttons" aria-hidden={adjustSliderDraggingId != null}>
                  <button className="adjust-action-button" type="button" aria-label="Upscale">
                    <img className="adjust-action-button-glyph" src={upscaleGlyph} alt="" aria-hidden="true" />
                    <span className="adjust-action-button-label">Upscale</span>
                  </button>
                  <button className="adjust-action-button" type="button" aria-label="Isolate">
                    <img className="adjust-action-button-glyph" src={isolateGlyph} alt="" aria-hidden="true" />
                    <span className="adjust-action-button-label">Isolate</span>
                  </button>
                  <button className="adjust-action-button" type="button" aria-label="Vary">
                    <img className="adjust-action-button-glyph" src={varyGlyph} alt="" aria-hidden="true" />
                    <span className="adjust-action-button-label">Vary</span>
                  </button>
                </div>
                <div className="adjust-sliders">
                  {ADJUST_SLIDER_IDS.map((id) => {
                    const value = adjustSliderValues[id] ?? 0
                    return (
                      <div
                        key={id}
                        className={`adjust-slider${adjustSliderDraggingId === id ? ' adjust-slider--active' : ''}`}
                        aria-label={id}
                        aria-hidden={adjustSliderDraggingId != null && adjustSliderDraggingId !== id}
                        onClick={(e) => {
                          const track = e.currentTarget
                          const rect = track.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const ratio = Math.max(0, Math.min(1, x / rect.width))
                          const newValue = Math.round(ratio * 200 - 100)
                          setAdjustSliderValues((prev) => ({ ...prev, [id]: newValue }))
                        }}
                      >
                        <div
                          className="adjust-slider-fill"
                          style={(() => {
                            if (value === 0) return { left: '50%', width: '0%' }
                            if (value > 0) return { left: '50%', width: `${(value / 100) * 50}%` }
                            return {
                              left: `${((value + 100) / 200) * 100}%`,
                              width: `${(-value / 100) * 50}%`,
                            }
                          })()}
                          aria-hidden="true"
                        />
                        <div className="adjust-slider-inner">
                          <span className="adjust-slider-name">{id}</span>
                          <span className="adjust-slider-value">{value}</span>
                        </div>
                        <div
                          className="adjust-slider-line"
                          role="slider"
                          aria-valuemin={-100}
                          aria-valuemax={100}
                          aria-valuenow={value}
                          aria-label={id}
                          tabIndex={0}
                          onPointerDown={(e) => {
                            e.preventDefault()
                            setAdjustSliderDraggingId(id)
                            const track = (e.currentTarget as HTMLElement).closest('.adjust-slider')
                            if (track) {
                              const rect = track.getBoundingClientRect()
                              const x = e.clientX - rect.left
                              const ratio = Math.max(0, Math.min(1, x / rect.width))
                              const newValue = Math.round(ratio * 200 - 100)
                              setAdjustSliderValues((prev) => ({ ...prev, [id]: newValue }))
                            }
                            ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                          }}
                          onPointerMove={(e) => {
                            if (e.buttons !== 1 && e.pointerType === 'mouse') return
                            const track = (e.currentTarget as HTMLElement).closest('.adjust-slider')
                            if (!track) return
                            const rect = track.getBoundingClientRect()
                            const x = e.clientX - rect.left
                            const ratio = Math.max(0, Math.min(1, x / rect.width))
                            const newValue = Math.round(ratio * 200 - 100)
                            setAdjustSliderValues((prev) => ({ ...prev, [id]: newValue }))
                          }}
                          onPointerUp={(e) => {
                            setAdjustSliderDraggingId(null)
                            ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                          }}
                          onPointerCancel={(e) => {
                            setAdjustSliderDraggingId(null)
                            ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'ArrowLeft') {
                              e.preventDefault()
                              setAdjustSliderValues((prev) => ({ ...prev, [id]: Math.max(-100, value - 1) }))
                            } else if (e.key === 'ArrowRight') {
                              e.preventDefault()
                              setAdjustSliderValues((prev) => ({ ...prev, [id]: Math.min(100, value + 1) }))
                            }
                          }}
                          style={{
                            left: `${((value + 100) / 200) * 100}%`,
                          }}
                        >
                          <span className="adjust-slider-line-inner" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              </>
            )}
            {activeBottomLeftMenu === 'effects' && (
              <div className="effects-grid">
                {effectNames.map((effectName) => (
                  <button key={effectName} className="effect-card" type="button">
                    <img className="effect-thumb" src={montBlancTrail} alt={effectName} />
                    <span className="effect-name">{effectName}</span>
                  </button>
                ))}
              </div>
            )}

            {activeBottomLeftMenu === 'quickEdit' && (
              <div className="quick-edit-actions">
                <button className="quick-edit-button" type="button">
                  <svg className="quick-edit-glyph" viewBox="0 0 24 20" aria-hidden="true">
                    <rect x="0.75" y="0.75" width="22.5" height="18.5" rx="3.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M4.06055 14V5.54492H5.37305V9.11914H9.70898V5.54492H11.0273V14H9.70898V10.2559H5.37305V14H4.06055ZM13.1543 14V5.54492H16.207C17.0469 5.54492 17.7637 5.71094 18.3574 6.04297C18.9512 6.375 19.4043 6.85352 19.7168 7.47852C20.0332 8.10352 20.1914 8.85938 20.1914 9.74609V9.75781C20.1914 10.6523 20.0332 11.416 19.7168 12.0488C19.4043 12.6816 18.9512 13.166 18.3574 13.502C17.7676 13.834 17.0508 14 16.207 14H13.1543ZM14.4668 12.8633H16.0605C16.6504 12.8633 17.1523 12.7422 17.5664 12.5C17.9844 12.2578 18.3008 11.9062 18.5156 11.4453C18.7344 10.9844 18.8438 10.4277 18.8438 9.77539V9.76367C18.8438 9.11523 18.7324 8.56055 18.5098 8.09961C18.291 7.63867 17.9746 7.28711 17.5605 7.04492C17.1465 6.80273 16.6465 6.68164 16.0605 6.68164H14.4668V12.8633Z" fill="currentColor" />
                  </svg>
                  <span>Upscale</span>
                </button>
                <button className="quick-edit-button" type="button">
                  <svg className="quick-edit-glyph" viewBox="0 0 17 17" aria-hidden="true">
                  <path d="M2.63672 1.5127C2.43164 1.5127 2.25293 1.43945 2.10059 1.29297C1.9541 1.14648 1.88086 0.967773 1.88086 0.756836C1.88086 0.551758 1.9541 0.375977 2.10059 0.229492C2.25293 0.0771484 2.43164 0.000976562 2.63672 0.000976562C2.84766 0.000976562 3.02637 0.0771484 3.17285 0.229492C3.31934 0.375977 3.39258 0.551758 3.39258 0.756836C3.39258 0.967773 3.31934 1.14648 3.17285 1.29297C3.02637 1.43945 2.84766 1.5127 2.63672 1.5127Z" fill="currentColor" />
                  <path d="M5.37891 1.5127C5.17383 1.5127 4.99512 1.43945 4.84277 1.29297C4.69629 1.14648 4.62305 0.967773 4.62305 0.756836C4.62305 0.551758 4.69629 0.375977 4.84277 0.229492C4.99512 0.0771484 5.17383 0.000976562 5.37891 0.000976562C5.58984 0.000976562 5.76855 0.0771484 5.91504 0.229492C6.06152 0.375977 6.13477 0.551758 6.13477 0.756836C6.13477 0.967773 6.06152 1.14648 5.91504 1.29297C5.76855 1.43945 5.58984 1.5127 5.37891 1.5127Z" fill="currentColor" />
                  <path d="M8.12109 1.5127C7.91602 1.5127 7.7373 1.43945 7.58496 1.29297C7.43848 1.14648 7.36523 0.967773 7.36523 0.756836C7.36523 0.551758 7.43848 0.375977 7.58496 0.229492C7.7373 0.0771484 7.91602 0.000976562 8.12109 0.000976562C8.33203 0.000976562 8.51074 0.0771484 8.65723 0.229492C8.80371 0.375977 8.87695 0.551758 8.87695 0.756836C8.87695 0.967773 8.80371 1.14648 8.65723 1.29297C8.51074 1.43945 8.33203 1.5127 8.12109 1.5127Z" fill="currentColor" />
                  <path d="M10.8721 1.5127C10.6611 1.5127 10.4824 1.43945 10.3359 1.29297C10.1895 1.14648 10.1162 0.967773 10.1162 0.756836C10.1162 0.551758 10.1895 0.375977 10.3359 0.229492C10.4824 0.0771484 10.6611 0.000976562 10.8721 0.000976562C11.0771 0.000976562 11.2529 0.0771484 11.3994 0.229492C11.5518 0.375977 11.6279 0.551758 11.6279 0.756836C11.6279 0.967773 11.5518 1.14648 11.3994 1.29297C11.2529 1.43945 11.0771 1.5127 10.8721 1.5127Z" fill="currentColor" />
                  <path d="M13.6143 1.5127C13.4033 1.5127 13.2246 1.43945 13.0781 1.29297C12.9316 1.14648 12.8584 0.967773 12.8584 0.756836C12.8584 0.551758 12.9316 0.375977 13.0781 0.229492C13.2246 0.0771484 13.4033 0.000976562 13.6143 0.000976562C13.8193 0.000976562 13.9951 0.0771484 14.1416 0.229492C14.2939 0.375977 14.3701 0.551758 14.3701 0.756836C14.3701 0.967773 14.2939 1.14648 14.1416 1.29297C13.9951 1.43945 13.8193 1.5127 13.6143 1.5127Z" fill="currentColor" />
                  <path d="M15.4951 3.40234C15.29 3.40234 15.1113 3.3291 14.959 3.18262C14.8125 3.03027 14.7393 2.85156 14.7393 2.64648C14.7393 2.43555 14.8125 2.25684 14.959 2.11035C15.1113 1.96387 15.29 1.89062 15.4951 1.89062C15.7002 1.89062 15.876 1.96387 16.0225 2.11035C16.1748 2.25684 16.251 2.43555 16.251 2.64648C16.251 2.85156 16.1748 3.03027 16.0225 3.18262C15.876 3.3291 15.7002 3.40234 15.4951 3.40234Z" fill="currentColor" />
                  <path d="M15.4951 6.14453C15.29 6.14453 15.1113 6.07129 14.959 5.9248C14.8125 5.77246 14.7393 5.59375 14.7393 5.38867C14.7393 5.17773 14.8125 4.99902 14.959 4.85254C15.1113 4.70605 15.29 4.63281 15.4951 4.63281C15.7002 4.63281 15.876 4.70605 16.0225 4.85254C16.1748 4.99902 16.251 5.17773 16.251 5.38867C16.251 5.59375 16.1748 5.77246 16.0225 5.9248C15.876 6.07129 15.7002 6.14453 15.4951 6.14453Z" fill="currentColor" />
                  <path d="M15.4951 8.88672C15.29 8.88672 15.1113 8.81348 14.959 8.66699C14.8125 8.51465 14.7393 8.33594 14.7393 8.13086C14.7393 7.92578 14.8125 7.75 14.959 7.60352C15.1113 7.45117 15.29 7.375 15.4951 7.375C15.7002 7.375 15.876 7.45117 16.0225 7.60352C16.1748 7.75 16.251 7.92578 16.251 8.13086C16.251 8.33594 16.1748 8.51465 16.0225 8.66699C15.876 8.81348 15.7002 8.88672 15.4951 8.88672Z" fill="currentColor" />
                  <path d="M15.4951 11.6289C15.29 11.6289 15.1113 11.5557 14.959 11.4092C14.8125 11.2568 14.7393 11.0781 14.7393 10.873C14.7393 10.668 14.8125 10.4922 14.959 10.3457C15.1113 10.1934 15.29 10.1172 15.4951 10.1172C15.7002 10.1172 15.876 10.1934 16.0225 10.3457C16.1748 10.4922 16.251 10.668 16.251 10.873C16.251 11.0781 16.1748 11.2568 16.0225 11.4092C15.876 11.5557 15.7002 11.6289 15.4951 11.6289Z" fill="currentColor" />
                  <path d="M15.4951 14.3711C15.29 14.3711 15.1113 14.2979 14.959 14.1514C14.8125 13.999 14.7393 13.8203 14.7393 13.6152C14.7393 13.4102 14.8125 13.2344 14.959 13.0879C15.1113 12.9355 15.29 12.8594 15.4951 12.8594C15.7002 12.8594 15.876 12.9355 16.0225 13.0879C16.1748 13.2344 16.251 13.4102 16.251 13.6152C16.251 13.8203 16.1748 13.999 16.0225 14.1514C15.876 14.2979 15.7002 14.3711 15.4951 14.3711Z" fill="currentColor" />
                  </svg>
                  <span>Isolate</span>
                </button>
                <button className="quick-edit-button" type="button">
                  <svg className="quick-edit-glyph" viewBox="0 0 21 16" aria-hidden="true">
                  <path d="M15.6445 0.544922C15.6445 0.369141 15.6914 0.234375 15.7852 0.140625C15.8848 0.046875 16.0254 0 16.207 0C16.2891 0 16.3682 0.0146484 16.4443 0.0439453C16.5264 0.0673828 16.5996 0.105469 16.6641 0.158203L19.9863 2.91797C20.127 3.04102 20.1973 3.18164 20.1973 3.33984C20.1973 3.49805 20.127 3.63574 19.9863 3.75293L16.6641 6.50391C16.5996 6.55664 16.5264 6.59766 16.4443 6.62695C16.3682 6.65625 16.2891 6.6709 16.207 6.6709C16.0254 6.6709 15.8848 6.62402 15.7852 6.53027C15.6914 6.43066 15.6445 6.29297 15.6445 6.11719V0.544922ZM0 12.4629C0 12.2461 0.0732422 12.0703 0.219727 11.9355C0.37207 11.8008 0.568359 11.7334 0.808594 11.7334H2.85645C3.30176 11.7334 3.69434 11.6426 4.03418 11.4609C4.37988 11.2793 4.74316 10.9658 5.12402 10.5205L10.4414 4.30664C10.9688 3.69141 11.4785 3.26367 11.9707 3.02344C12.4629 2.7832 13.0752 2.66309 13.8076 2.66309H16.9365C17.1416 2.66309 17.3145 2.73633 17.4551 2.88281C17.6016 3.02344 17.6748 3.19629 17.6748 3.40137C17.6748 3.60059 17.6016 3.77344 17.4551 3.91992C17.3145 4.06055 17.1416 4.13086 16.9365 4.13086H13.8516C13.5293 4.13086 13.2363 4.17188 12.9727 4.25391C12.7148 4.33008 12.4658 4.45605 12.2256 4.63184C11.9912 4.80762 11.748 5.04199 11.4961 5.33496L6.16992 11.5488C5.63672 12.1641 5.12402 12.5918 4.63184 12.832C4.14551 13.0723 3.53906 13.1924 2.8125 13.1924H0.808594C0.568359 13.1924 0.37207 13.125 0.219727 12.9902C0.0732422 12.8555 0 12.6797 0 12.4629ZM15.6445 15.3809V9.80859C15.6445 9.63281 15.6914 9.49805 15.7852 9.4043C15.8848 9.30469 16.0254 9.25488 16.207 9.25488C16.2891 9.25488 16.3682 9.26953 16.4443 9.29883C16.5264 9.32812 16.5996 9.36914 16.6641 9.42188L19.9863 12.1729C20.127 12.29 20.1973 12.4277 20.1973 12.5859C20.1973 12.7441 20.127 12.8848 19.9863 13.0078L16.6641 15.7676C16.5996 15.8203 16.5264 15.8584 16.4443 15.8818C16.3682 15.9111 16.2891 15.9258 16.207 15.9258C16.0254 15.9258 15.8848 15.8789 15.7852 15.7852C15.6914 15.6914 15.6445 15.5566 15.6445 15.3809ZM0 3.46289C0 3.24609 0.0732422 3.07031 0.219727 2.93555C0.37207 2.80078 0.568359 2.7334 0.808594 2.7334H2.8125C3.53906 2.7334 4.14551 2.85352 4.63184 3.09375C5.12402 3.33398 5.63672 3.76172 6.16992 4.37695L11.4961 10.5908C11.748 10.8838 11.9912 11.1182 12.2256 11.2939C12.4658 11.4697 12.7148 11.5986 12.9727 11.6807C13.2363 11.7568 13.5293 11.7949 13.8516 11.7949H16.9365C17.1416 11.7949 17.3145 11.8682 17.4551 12.0146C17.6016 12.1553 17.6748 12.3252 17.6748 12.5244C17.6748 12.7295 17.6016 12.9053 17.4551 13.0518C17.3145 13.1924 17.1416 13.2627 16.9365 13.2627H13.8076C13.0752 13.2627 12.4629 13.1426 11.9707 12.9023C11.4785 12.6621 10.9688 12.2344 10.4414 11.6191L5.12402 5.40527C4.74316 4.95996 4.37988 4.64648 4.03418 4.46484C3.69434 4.2832 3.30176 4.19238 2.85645 4.19238H0.808594C0.568359 4.19238 0.37207 4.125 0.219727 3.99023C0.0732422 3.85547 0 3.67969 0 3.46289Z" fill="currentColor" />
                  </svg>
                  <span>Vary</span>
                </button>
              </div>
            )}
          </section>
        )}

        <nav className="bottom-left-actions" style={{ bottom: `${controlsBottomPx}px` }} aria-label="Canvas actions">
          <button className={`text-action-button${activeBottomLeftMenu === 'info' ? ' active' : ''}`} type="button" aria-label="Info" onClick={() => toggleBottomLeftMenu('info')}>
          <svg className="text-action-glyph info-glyph" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M8.96484 17.9297C7.72852 17.9297 6.56836 17.6953 5.48438 17.2266C4.40039 16.7637 3.44824 16.1221 2.62793 15.3018C1.80762 14.4814 1.16309 13.5293 0.694336 12.4453C0.231445 11.3613 0 10.2012 0 8.96484C0 7.72852 0.231445 6.56836 0.694336 5.48438C1.16309 4.40039 1.80762 3.44824 2.62793 2.62793C3.44824 1.80176 4.40039 1.15723 5.48438 0.694336C6.56836 0.231445 7.72852 0 8.96484 0C10.2012 0 11.3613 0.231445 12.4453 0.694336C13.5293 1.15723 14.4814 1.80176 15.3018 2.62793C16.1221 3.44824 16.7637 4.40039 17.2266 5.48438C17.6953 6.56836 17.9297 7.72852 17.9297 8.96484C17.9297 10.2012 17.6953 11.3613 17.2266 12.4453C16.7637 13.5293 16.1221 14.4814 15.3018 15.3018C14.4814 16.1221 13.5293 16.7637 12.4453 17.2266C11.3613 17.6953 10.2012 17.9297 8.96484 17.9297ZM8.96484 16.4355C9.99609 16.4355 10.9629 16.2422 11.8652 15.8555C12.7676 15.4688 13.5615 14.9326 14.2471 14.2471C14.9326 13.5615 15.4688 12.7676 15.8555 11.8652C16.2422 10.9629 16.4355 9.99609 16.4355 8.96484C16.4355 7.93359 16.2422 6.9668 15.8555 6.06445C15.4688 5.15625 14.9326 4.3623 14.2471 3.68262C13.5615 2.99707 12.7676 2.46094 11.8652 2.07422C10.9629 1.6875 9.99609 1.49414 8.96484 1.49414C7.93359 1.49414 6.9668 1.6875 6.06445 2.07422C5.16211 2.46094 4.36816 2.99707 3.68262 3.68262C2.99707 4.3623 2.46094 5.15625 2.07422 6.06445C1.6875 6.9668 1.49414 7.93359 1.49414 8.96484C1.49414 9.99609 1.6875 10.9629 2.07422 11.8652C2.46094 12.7676 2.99707 13.5615 3.68262 14.2471C4.36816 14.9326 5.16211 15.4688 6.06445 15.8555C6.9668 16.2422 7.93359 16.4355 8.96484 16.4355ZM7.42676 13.8779C7.24512 13.8779 7.09277 13.8193 6.96973 13.7021C6.84668 13.585 6.78516 13.4385 6.78516 13.2627C6.78516 13.0869 6.84668 12.9404 6.96973 12.8232C7.09277 12.7061 7.24512 12.6475 7.42676 12.6475H8.5166V8.61328H7.57617C7.39453 8.61328 7.24219 8.55469 7.11914 8.4375C6.99609 8.32031 6.93457 8.17383 6.93457 7.99805C6.93457 7.82227 6.99609 7.67578 7.11914 7.55859C7.24219 7.44141 7.39453 7.38281 7.57617 7.38281H9.22852C9.45117 7.38281 9.62109 7.45605 9.73828 7.60254C9.85547 7.74316 9.91406 7.93359 9.91406 8.17383V12.6475H11.0039C11.1855 12.6475 11.3379 12.7061 11.4609 12.8232C11.584 12.9404 11.6455 13.0869 11.6455 13.2627C11.6455 13.4385 11.584 13.585 11.4609 13.7021C11.3379 13.8193 11.1855 13.8779 11.0039 13.8779H7.42676ZM8.88574 5.91504C8.56934 5.91504 8.2998 5.80371 8.07715 5.58105C7.85449 5.3584 7.74316 5.08887 7.74316 4.77246C7.74316 4.4502 7.85449 4.17773 8.07715 3.95508C8.2998 3.73242 8.56934 3.62109 8.88574 3.62109C9.20801 3.62109 9.47754 3.73242 9.69434 3.95508C9.91699 4.17773 10.0283 4.4502 10.0283 4.77246C10.0283 5.08887 9.91699 5.3584 9.69434 5.58105C9.47754 5.80371 9.20801 5.91504 8.88574 5.91504Z"
              fill="currentColor"
            />
          </svg>
          <span>Info</span>
        </button>
          <button className={`text-action-button${activeBottomLeftMenu === 'objects' ? ' active' : ''}`} type="button" aria-label="Objects" onClick={() => toggleBottomLeftMenu('objects')}>
          <svg className="text-action-glyph objects-glyph" viewBox="0 0 18 20" aria-hidden="true">
            <path
              d="M13.5088 12.4014L14.8799 11.5049L16.9717 12.7266C17.3291 12.9375 17.584 13.1338 17.7363 13.3154C17.8887 13.4912 17.9648 13.6992 17.9648 13.9395C17.9648 14.1855 17.8887 14.3994 17.7363 14.5811C17.584 14.7568 17.3291 14.9502 16.9717 15.1611L10.0986 19.1514C9.8877 19.2744 9.69141 19.3652 9.50977 19.4238C9.33398 19.4824 9.1582 19.5117 8.98242 19.5117C8.80078 19.5117 8.62207 19.4824 8.44629 19.4238C8.27051 19.3652 8.07715 19.2744 7.86621 19.1514L0.984375 15.1611C0.632812 14.9502 0.380859 14.7568 0.228516 14.5811C0.0761719 14.3994 0 14.1855 0 13.9395C0 13.6992 0.0761719 13.4912 0.228516 13.3154C0.380859 13.1338 0.632812 12.9375 0.984375 12.7266L3.18164 11.4521L4.6582 12.2871L1.89844 13.8604C1.85742 13.8838 1.83691 13.9102 1.83691 13.9395C1.83691 13.9746 1.85742 14.0039 1.89844 14.0273L8.58691 17.8594C8.7334 17.9414 8.86523 17.9824 8.98242 17.9824C9.09375 17.9824 9.22266 17.9414 9.36914 17.8594L16.0576 14.0273C16.1045 14.0039 16.1279 13.9746 16.1279 13.9395C16.1279 13.9102 16.1045 13.8838 16.0576 13.8604L13.5088 12.4014ZM13.3154 8.24414L14.6777 7.33887L16.9717 8.6748C17.3291 8.88574 17.584 9.08203 17.7363 9.26367C17.8887 9.44531 17.9648 9.65625 17.9648 9.89648C17.9648 10.1367 17.8887 10.3477 17.7363 10.5293C17.584 10.7109 17.3291 10.9043 16.9717 11.1094L10.0986 15.1084C9.8877 15.2314 9.69141 15.3223 9.50977 15.3809C9.33398 15.4395 9.1582 15.4688 8.98242 15.4688C8.80078 15.4688 8.62207 15.4395 8.44629 15.3809C8.27051 15.3223 8.07715 15.2314 7.86621 15.1084L0.984375 11.1094C0.632812 10.9043 0.380859 10.7109 0.228516 10.5293C0.0761719 10.3477 0 10.1367 0 9.89648C0 9.65625 0.0761719 9.44531 0.228516 9.26367C0.380859 9.08203 0.632812 8.88574 0.984375 8.6748L3.4541 7.25098L4.86035 8.1123L1.89844 9.80859C1.85742 9.83203 1.83691 9.86133 1.83691 9.89648C1.83691 9.93164 1.85742 9.96094 1.89844 9.98438L8.58691 13.8076C8.7334 13.8896 8.86523 13.9307 8.98242 13.9307C9.09375 13.9307 9.22266 13.8896 9.36914 13.8076L16.0576 9.98438C16.1045 9.96094 16.1279 9.93164 16.1279 9.89648C16.1279 9.86133 16.1045 9.83203 16.0576 9.80859L13.3154 8.24414ZM8.98242 11.1357C8.80078 11.1357 8.62207 11.1064 8.44629 11.0479C8.27051 10.9893 8.07715 10.8984 7.86621 10.7754L0.984375 6.78516C0.632812 6.57422 0.380859 6.38086 0.228516 6.20508C0.0761719 6.02344 0 5.80957 0 5.56348C0 5.32324 0.0761719 5.11523 0.228516 4.93945C0.380859 4.75781 0.632812 4.56152 0.984375 4.35059L7.86621 0.360352C8.07715 0.237305 8.27051 0.146484 8.44629 0.0878906C8.62207 0.0292969 8.80078 0 8.98242 0C9.1582 0 9.33398 0.0292969 9.50977 0.0878906C9.69141 0.146484 9.8877 0.237305 10.0986 0.360352L16.9717 4.35059C17.3291 4.56152 17.584 4.75781 17.7363 4.93945C17.8887 5.11523 17.9648 5.32324 17.9648 5.56348C17.9648 5.80957 17.8887 6.02344 17.7363 6.20508C17.584 6.38086 17.3291 6.57422 16.9717 6.78516L10.0986 10.7754C9.8877 10.8984 9.69141 10.9893 9.50977 11.0479C9.33398 11.1064 9.1582 11.1357 8.98242 11.1357Z"
              fill="currentColor"
            />
          </svg>
          <span>Objects</span>
        </button>
          <button className={`text-action-button text-action-button--adjust${activeBottomLeftMenu === 'adjust' ? ' active' : ''}`} type="button" aria-label="Adjust" onClick={() => toggleBottomLeftMenu('adjust')}>
            <img className="text-action-glyph adjust-glyph" src={adjustGlyph} alt="" aria-hidden="true" />
            <span>Adjust</span>
          </button>
          <button className={`text-action-button${activeBottomLeftMenu === 'effects' ? ' active' : ''}`} type="button" aria-label="Effects" onClick={() => toggleBottomLeftMenu('effects')}>
          <svg className="text-action-glyph effects-glyph" viewBox="0 0 23 22" aria-hidden="true">
            <path
              d="M6.93457 9.63281C6.78809 9.63281 6.66504 9.58594 6.56543 9.49219C6.46582 9.39258 6.41602 9.2666 6.41602 9.11426L6.40723 8.12988L5.72168 8.83301C5.61621 8.94434 5.49023 8.99707 5.34375 8.99121C5.20312 8.98535 5.08008 8.93262 4.97461 8.83301C4.875 8.72754 4.82227 8.60449 4.81641 8.46387C4.81641 8.31738 4.86914 8.19141 4.97461 8.08594L5.67773 7.40039H4.69336C4.54688 7.40039 4.4209 7.35059 4.31543 7.25098C4.21582 7.14551 4.16602 7.01953 4.16602 6.87305C4.16602 6.73242 4.21582 6.6123 4.31543 6.5127C4.4209 6.40723 4.54688 6.35449 4.69336 6.35449H5.67773L4.96582 5.66895C4.86621 5.56348 4.81641 5.4375 4.81641 5.29102C4.82227 5.14453 4.87207 5.01855 4.96582 4.91309C5.07715 4.81348 5.20312 4.76367 5.34375 4.76367C5.49023 4.76367 5.61621 4.81348 5.72168 4.91309L6.41602 5.60742L6.40723 4.64062C6.40723 4.48828 6.45703 4.3623 6.55664 4.2627C6.66211 4.16309 6.78516 4.11328 6.92578 4.11328C7.07812 4.11328 7.2041 4.16309 7.30371 4.2627C7.40332 4.3623 7.45312 4.48828 7.45312 4.64062L7.46191 5.60742L8.13867 4.91309C8.24414 4.80762 8.37012 4.75781 8.5166 4.76367C8.66309 4.76953 8.78906 4.81934 8.89453 4.91309C8.99414 5.01855 9.04395 5.14453 9.04395 5.29102C9.0498 5.4375 9 5.56348 8.89453 5.66895L8.19141 6.35449H9.17578C9.32227 6.35449 9.44531 6.40723 9.54492 6.5127C9.65039 6.6123 9.70312 6.73242 9.70312 6.87305C9.70312 7.01953 9.65039 7.14551 9.54492 7.25098C9.44531 7.35059 9.32227 7.40039 9.17578 7.40039H8.19141L8.90332 8.08594C9.00293 8.19141 9.0498 8.31738 9.04395 8.46387C9.04395 8.61035 8.99707 8.7334 8.90332 8.83301C8.79785 8.93848 8.67188 8.99121 8.52539 8.99121C8.37891 8.99121 8.25586 8.93848 8.15625 8.83301L7.45312 8.12988L7.46191 9.11426C7.46191 9.2666 7.40918 9.39258 7.30371 9.49219C7.2041 9.58594 7.08105 9.63281 6.93457 9.63281ZM6.94336 3.07617C6.78516 3.07617 6.64746 3.02051 6.53027 2.90918C6.41895 2.79199 6.36328 2.6543 6.36328 2.49609V0.571289C6.36328 0.413086 6.41895 0.27832 6.53027 0.166992C6.64746 0.0556641 6.78516 0 6.94336 0C7.10156 0 7.23633 0.0556641 7.34766 0.166992C7.45898 0.27832 7.51465 0.413086 7.51465 0.571289V2.49609C7.51465 2.6543 7.45898 2.79199 7.34766 2.90918C7.23633 3.02051 7.10156 3.07617 6.94336 3.07617ZM8.86816 3.58594C8.7334 3.50977 8.64551 3.39551 8.60449 3.24316C8.56348 3.09082 8.58105 2.94434 8.65723 2.80371L9.62402 1.14258C9.70605 1.00195 9.82324 0.911133 9.97559 0.870117C10.1279 0.829102 10.2744 0.849609 10.415 0.931641C10.5498 1.00781 10.6377 1.125 10.6787 1.2832C10.7256 1.43555 10.708 1.58203 10.626 1.72266L9.65918 3.375C9.57715 3.51562 9.45996 3.60645 9.30762 3.64746C9.15527 3.68848 9.00879 3.66797 8.86816 3.58594ZM10.2832 5.00098C10.207 4.86621 10.1895 4.72266 10.2305 4.57031C10.2715 4.41211 10.3594 4.29492 10.4941 4.21875L12.1641 3.26074C12.2988 3.18457 12.4424 3.16699 12.5947 3.20801C12.7529 3.24316 12.8701 3.33105 12.9463 3.47168C13.0283 3.60645 13.0459 3.75293 12.999 3.91113C12.958 4.06348 12.8701 4.17773 12.7354 4.25391L11.0742 5.21191C10.9395 5.28809 10.793 5.30859 10.6348 5.27344C10.4824 5.23242 10.3652 5.1416 10.2832 5.00098ZM10.8018 6.93457C10.8018 6.77637 10.8574 6.6416 10.9688 6.53027C11.0859 6.41309 11.2207 6.35449 11.373 6.35449L13.3066 6.36328C13.459 6.36328 13.5938 6.41895 13.7109 6.53027C13.8281 6.6416 13.8867 6.7793 13.8867 6.94336C13.8867 7.0957 13.8281 7.23047 13.7109 7.34766C13.5938 7.45898 13.4561 7.51465 13.2979 7.51465L11.373 7.50586C11.2207 7.50586 11.0859 7.45312 10.9688 7.34766C10.8574 7.23633 10.8018 7.09863 10.8018 6.93457ZM10.2832 8.85938C10.3594 8.72461 10.4766 8.63672 10.6348 8.5957C10.793 8.55469 10.9395 8.57227 11.0742 8.64844L12.7354 9.62402C12.8701 9.7002 12.958 9.81445 12.999 9.9668C13.0459 10.1191 13.0283 10.2686 12.9463 10.415C12.8701 10.5439 12.7529 10.6318 12.5947 10.6787C12.4424 10.7197 12.2959 10.6992 12.1553 10.6172L10.4941 9.65039C10.3652 9.57422 10.2773 9.45996 10.2305 9.30762C10.1895 9.15527 10.207 9.00586 10.2832 8.85938ZM8.86816 10.2744C9.00293 10.1982 9.14941 10.1836 9.30762 10.2305C9.46582 10.2715 9.58301 10.3564 9.65918 10.4854L10.6172 12.1641C10.6934 12.2988 10.7109 12.4453 10.6699 12.6035C10.6348 12.7559 10.5498 12.8701 10.415 12.9463C10.2803 13.0283 10.1309 13.0459 9.9668 12.999C9.80859 12.9521 9.69141 12.8613 9.61523 12.7266L8.65723 11.0654C8.58105 10.9307 8.56055 10.7871 8.5957 10.6348C8.63672 10.4824 8.72754 10.3623 8.86816 10.2744ZM6.94336 10.8018C7.10156 10.8018 7.23633 10.8574 7.34766 10.9688C7.45898 11.0801 7.51465 11.2148 7.51465 11.373V13.2979C7.51465 13.4561 7.45898 13.5908 7.34766 13.7021C7.23633 13.8135 7.10156 13.8691 6.94336 13.8691C6.78516 13.8691 6.64746 13.8135 6.53027 13.7021C6.41895 13.5908 6.36328 13.4561 6.36328 13.2979V11.373C6.36328 11.2148 6.41895 11.0801 6.53027 10.9688C6.64746 10.8574 6.78516 10.8018 6.94336 10.8018ZM5.00977 10.2832C5.14453 10.3594 5.23242 10.4766 5.27344 10.6348C5.32031 10.7871 5.30273 10.9336 5.2207 11.0742L4.25391 12.7266C4.17188 12.8672 4.05469 12.958 3.90234 12.999C3.75586 13.04 3.6123 13.0195 3.47168 12.9375C3.33691 12.8613 3.24609 12.7471 3.19922 12.5947C3.1582 12.4424 3.17871 12.2959 3.26074 12.1553L4.22754 10.4941C4.30957 10.3535 4.42383 10.2627 4.57031 10.2217C4.72266 10.1807 4.86914 10.2012 5.00977 10.2832ZM3.59473 8.86816C3.67676 9.00293 3.69434 9.14941 3.64746 9.30762C3.60645 9.46582 3.51855 9.58301 3.38379 9.65918L1.72266 10.6172C1.58789 10.6934 1.44141 10.7109 1.2832 10.6699C1.13086 10.6289 1.01367 10.541 0.931641 10.4062C0.855469 10.2715 0.837891 10.125 0.878906 9.9668C0.919922 9.80859 1.00781 9.69141 1.14258 9.61523L2.8125 8.65723C2.94727 8.58105 3.09082 8.56348 3.24316 8.60449C3.39551 8.63965 3.5127 8.72754 3.59473 8.86816ZM3.08496 6.94336C3.08496 7.0957 3.02637 7.23047 2.90918 7.34766C2.79199 7.45898 2.65723 7.51465 2.50488 7.51465L0.580078 7.50586C0.421875 7.50586 0.28418 7.4502 0.166992 7.33887C0.0556641 7.22754 0 7.09277 0 6.93457C0 6.77637 0.0556641 6.6416 0.166992 6.53027C0.28418 6.41309 0.424805 6.35449 0.588867 6.35449L2.50488 6.36328C2.65723 6.36328 2.79199 6.41895 2.90918 6.53027C3.02637 6.6416 3.08496 6.7793 3.08496 6.94336ZM3.59473 5.00977C3.51855 5.14453 3.40137 5.23242 3.24316 5.27344C3.08496 5.31445 2.94141 5.29688 2.8125 5.2207L1.14258 4.24512C1.01367 4.16895 0.925781 4.05469 0.878906 3.90234C0.837891 3.75 0.855469 3.60352 0.931641 3.46289C1.01367 3.33398 1.13086 3.24902 1.2832 3.20801C1.44141 3.16113 1.59082 3.17871 1.73145 3.26074L3.38379 4.22754C3.51855 4.30371 3.60645 4.41797 3.64746 4.57031C3.69434 4.72266 3.67676 4.86914 3.59473 5.00977ZM5.00977 3.59473C4.875 3.67676 4.72852 3.69727 4.57031 3.65625C4.41797 3.60938 4.30371 3.51855 4.22754 3.38379L3.26953 1.71387C3.19336 1.5791 3.17285 1.43555 3.20801 1.2832C3.24316 1.125 3.33105 1.00488 3.47168 0.922852C3.60645 0.84668 3.75293 0.832031 3.91113 0.878906C4.06934 0.919922 4.18652 1.00781 4.2627 1.14258L5.2207 2.8125C5.29688 2.94141 5.31445 3.08496 5.27344 3.24316C5.23828 3.39551 5.15039 3.5127 5.00977 3.59473ZM18.0264 18.2285C17.8857 18.2285 17.7656 18.1787 17.666 18.0791C17.5723 17.9854 17.5254 17.8682 17.5254 17.7275V16.374L16.8223 17.0771C16.7168 17.1826 16.5938 17.2354 16.4531 17.2354C16.3184 17.2354 16.2012 17.1826 16.1016 17.0771C15.9961 16.9775 15.9434 16.8604 15.9434 16.7256C15.9434 16.5908 15.9961 16.4707 16.1016 16.3652L16.8047 15.6621H15.4512C15.3164 15.6621 15.1992 15.6123 15.0996 15.5127C15.0059 15.4131 14.959 15.293 14.959 15.1523C14.959 15.0117 15.0059 14.8945 15.0996 14.8008C15.1992 14.7012 15.3164 14.6514 15.4512 14.6514H16.8047L16.0928 13.9395C15.9932 13.8398 15.9434 13.7227 15.9434 13.5879C15.9434 13.4473 15.9961 13.3271 16.1016 13.2275C16.2012 13.1221 16.3213 13.0693 16.4619 13.0693C16.6025 13.0693 16.7227 13.1221 16.8223 13.2275L17.5254 13.9307V12.5859C17.5254 12.4453 17.5723 12.3252 17.666 12.2256C17.7656 12.126 17.8857 12.0762 18.0264 12.0762C18.167 12.0762 18.2871 12.126 18.3867 12.2256C18.4863 12.3252 18.5361 12.4453 18.5361 12.5859V13.9307L19.248 13.2275C19.3477 13.1221 19.4648 13.0693 19.5996 13.0693C19.7402 13.0693 19.8604 13.1221 19.96 13.2275C20.0654 13.3271 20.1182 13.4473 20.1182 13.5879C20.1182 13.7227 20.0654 13.8398 19.96 13.9395L19.248 14.6514H20.6016C20.7422 14.6514 20.8623 14.7012 20.9619 14.8008C21.0615 14.8945 21.1113 15.0117 21.1113 15.1523C21.1113 15.293 21.0615 15.4131 20.9619 15.5127C20.8623 15.6123 20.7422 15.6621 20.6016 15.6621H19.2568L19.9512 16.3652C20.0625 16.4707 20.1182 16.5908 20.1182 16.7256C20.1182 16.8604 20.0625 16.9775 19.9512 17.0771C19.8574 17.1826 19.7402 17.2354 19.5996 17.2354C19.4648 17.2354 19.3477 17.1826 19.248 17.0771L18.5361 16.374V17.7275C18.5361 17.8682 18.4863 17.9854 18.3867 18.0791C18.2871 18.1787 18.167 18.2285 18.0264 18.2285ZM18.0352 11.5225C17.8477 11.5225 17.6895 11.458 17.5605 11.3291C17.4316 11.2002 17.3672 11.0391 17.3672 10.8457C17.3672 10.6641 17.4316 10.5088 17.5605 10.3799C17.6895 10.2451 17.8477 10.1777 18.0352 10.1777C18.2168 10.1777 18.3721 10.2451 18.501 10.3799C18.6299 10.5088 18.6943 10.6641 18.6943 10.8457C18.6943 11.0391 18.6299 11.2002 18.501 11.3291C18.3721 11.458 18.2168 11.5225 18.0352 11.5225ZM20.9531 12.8408C20.7832 12.8408 20.6367 12.7822 20.5137 12.665C20.3965 12.542 20.3379 12.3926 20.3379 12.2168C20.3379 12.0469 20.3965 11.9033 20.5137 11.7861C20.6367 11.6631 20.7832 11.6016 20.9531 11.6016C21.123 11.6016 21.2695 11.6631 21.3926 11.7861C21.5156 11.9033 21.5771 12.0469 21.5771 12.2168C21.5771 12.3926 21.5156 12.542 21.3926 12.665C21.2695 12.7822 21.123 12.8408 20.9531 12.8408ZM22.3418 15.8203C22.1484 15.8203 21.9873 15.7559 21.8584 15.627C21.7354 15.498 21.6738 15.3398 21.6738 15.1523C21.6738 14.9707 21.7354 14.8154 21.8584 14.6865C21.9873 14.5576 22.1484 14.4932 22.3418 14.4932C22.5234 14.4932 22.6787 14.5576 22.8076 14.6865C22.9424 14.8154 23.0098 14.9707 23.0098 15.1523C23.0098 15.3398 22.9424 15.498 22.8076 15.627C22.6787 15.7559 22.5234 15.8203 22.3418 15.8203ZM20.9531 18.7119C20.7832 18.7119 20.6367 18.6504 20.5137 18.5273C20.3965 18.4102 20.3379 18.2666 20.3379 18.0967C20.3379 17.9209 20.3965 17.7715 20.5137 17.6484C20.6367 17.5312 20.7832 17.4727 20.9531 17.4727C21.123 17.4727 21.2695 17.5312 21.3926 17.6484C21.5156 17.7715 21.5771 17.9209 21.5771 18.0967C21.5771 18.2666 21.5156 18.4102 21.3926 18.5273C21.2695 18.6504 21.123 18.7119 20.9531 18.7119ZM18.0352 20.127C17.8477 20.127 17.6895 20.0625 17.5605 19.9336C17.4316 19.8047 17.3672 19.6494 17.3672 19.4678C17.3672 19.2744 17.4316 19.1133 17.5605 18.9844C17.6895 18.8555 17.8477 18.791 18.0352 18.791C18.2168 18.791 18.3721 18.8555 18.501 18.9844C18.6299 19.1133 18.6943 19.2744 18.6943 19.4678C18.6943 19.6494 18.6299 19.8047 18.501 19.9336C18.3721 20.0625 18.2168 20.127 18.0352 20.127ZM15.1084 18.7031C14.9385 18.7031 14.792 18.6445 14.6689 18.5273C14.5459 18.4102 14.4844 18.2666 14.4844 18.0967C14.4844 17.9209 14.5459 17.7715 14.6689 17.6484C14.792 17.5312 14.9385 17.4727 15.1084 17.4727C15.2783 17.4727 15.4219 17.5312 15.5391 17.6484C15.6621 17.7715 15.7236 17.9209 15.7236 18.0967C15.7236 18.2666 15.6621 18.4102 15.5391 18.5273C15.4219 18.6445 15.2783 18.7031 15.1084 18.7031ZM13.7197 15.8203C13.5381 15.8203 13.3828 15.7559 13.2539 15.627C13.125 15.498 13.0605 15.3398 13.0605 15.1523C13.0605 14.9707 13.125 14.8154 13.2539 14.6865C13.3828 14.5576 13.5381 14.4932 13.7197 14.4932C13.9131 14.4932 14.0742 14.5576 14.2031 14.6865C14.332 14.8154 14.3936 14.9707 14.3877 15.1523C14.3936 15.3398 14.332 15.498 14.2031 15.627C14.0742 15.7559 13.9131 15.8203 13.7197 15.8203ZM15.1084 12.8408C14.9385 12.8408 14.792 12.7822 14.6689 12.665C14.5459 12.542 14.4844 12.3926 14.4844 12.2168C14.4844 12.0469 14.5459 11.9033 14.6689 11.7861C14.792 11.6631 14.9385 11.6016 15.1084 11.6016C15.2783 11.6016 15.4219 11.6631 15.5391 11.7861C15.6621 11.9033 15.7236 12.0469 15.7236 12.2168C15.7236 12.3926 15.6621 12.542 15.5391 12.665C15.4219 12.7822 15.2783 12.8408 15.1084 12.8408ZM18.8086 7.80469C18.7148 7.80469 18.6416 7.78125 18.5889 7.73438C18.5361 7.68164 18.5039 7.61719 18.4922 7.54102C18.3926 7.01953 18.2988 6.62109 18.2109 6.3457C18.1289 6.06445 18.0146 5.85938 17.8682 5.73047C17.7275 5.60156 17.5225 5.50488 17.2529 5.44043C16.9893 5.37012 16.623 5.28809 16.1543 5.19434C15.9785 5.15918 15.8906 5.05371 15.8906 4.87793C15.8906 4.7959 15.9141 4.72852 15.9609 4.67578C16.0137 4.62305 16.0781 4.58789 16.1543 4.57031C16.623 4.47656 16.9893 4.39746 17.2529 4.33301C17.5225 4.2627 17.7275 4.16309 17.8682 4.03418C18.0146 3.89941 18.1289 3.69434 18.2109 3.41895C18.2988 3.1377 18.3926 2.73926 18.4922 2.22363C18.5273 2.04785 18.6328 1.95996 18.8086 1.95996C18.9785 1.95996 19.0811 2.04785 19.1162 2.22363C19.2158 2.7334 19.3037 3.12891 19.3799 3.41016C19.4561 3.68555 19.5615 3.8877 19.6963 4.0166C19.8311 4.14551 20.0361 4.24512 20.3115 4.31543C20.5869 4.38574 20.9736 4.4707 21.4717 4.57031C21.6475 4.61133 21.7354 4.71387 21.7354 4.87793C21.7354 5.05371 21.6475 5.15918 21.4717 5.19434C20.9736 5.29395 20.5869 5.37598 20.3115 5.44043C20.042 5.50488 19.8369 5.60156 19.6963 5.73047C19.5615 5.85938 19.4561 6.06445 19.3799 6.3457C19.3037 6.62109 19.2158 7.01953 19.1162 7.54102C19.0811 7.7168 18.9785 7.80469 18.8086 7.80469ZM9.7207 21.832C9.64453 21.832 9.58301 21.8086 9.53613 21.7617C9.49512 21.7207 9.46875 21.668 9.45703 21.6035C9.375 21.1992 9.29883 20.8828 9.22852 20.6543C9.16406 20.4258 9.07324 20.2529 8.95605 20.1357C8.84473 20.0244 8.6748 19.9365 8.44629 19.8721C8.22363 19.8076 7.91309 19.7344 7.51465 19.6523C7.35645 19.623 7.27734 19.5352 7.27734 19.3887C7.27734 19.2422 7.35645 19.1572 7.51465 19.1338C7.91309 19.0459 8.22363 18.9697 8.44629 18.9053C8.6748 18.8408 8.84473 18.75 8.95605 18.6328C9.07324 18.5215 9.16406 18.3516 9.22852 18.123C9.29883 17.9004 9.375 17.5869 9.45703 17.1826C9.48633 17.0303 9.57422 16.9541 9.7207 16.9541C9.86719 16.9541 9.95215 17.0303 9.97559 17.1826C10.0576 17.5869 10.1309 17.9004 10.1953 18.123C10.2656 18.3516 10.3564 18.5215 10.4678 18.6328C10.585 18.75 10.7549 18.8408 10.9775 18.9053C11.2061 18.9697 11.5225 19.0459 11.9268 19.1338C12.0791 19.1572 12.1553 19.2422 12.1553 19.3887C12.1553 19.5352 12.0791 19.623 11.9268 19.6523C11.5225 19.7344 11.2061 19.8076 10.9775 19.8721C10.7549 19.9365 10.585 20.0244 10.4678 20.1357C10.3564 20.2529 10.2656 20.4229 10.1953 20.6455C10.1309 20.874 10.0576 21.1934 9.97559 21.6035C9.95215 21.7559 9.86719 21.832 9.7207 21.832ZM5.15039 18.9756C5.02734 18.9756 4.9541 18.9141 4.93066 18.791C4.86621 18.457 4.80469 18.1963 4.74609 18.0088C4.69336 17.8271 4.62012 17.6895 4.52637 17.5957C4.43262 17.502 4.29199 17.4287 4.10449 17.376C3.92285 17.3232 3.66797 17.2646 3.33984 17.2002C3.21094 17.1768 3.14648 17.1035 3.14648 16.9805C3.14648 16.8574 3.21094 16.7842 3.33984 16.7607C3.66797 16.6963 3.92285 16.6377 4.10449 16.585C4.29199 16.5322 4.43262 16.459 4.52637 16.3652C4.62012 16.2715 4.69336 16.1338 4.74609 15.9521C4.80469 15.7646 4.86621 15.5039 4.93066 15.1699C4.9541 15.0469 5.02734 14.9854 5.15039 14.9854C5.27344 14.9854 5.34375 15.0469 5.36133 15.1699C5.43164 15.5039 5.49316 15.7646 5.5459 15.9521C5.59863 16.1338 5.67188 16.2715 5.76562 16.3652C5.85938 16.459 5.99707 16.5322 6.17871 16.585C6.36621 16.6377 6.62402 16.6963 6.95215 16.7607C7.08105 16.7842 7.14551 16.8574 7.14551 16.9805C7.14551 17.1035 7.08105 17.1768 6.95215 17.2002C6.62402 17.2646 6.36621 17.3232 6.17871 17.376C5.99707 17.4287 5.85938 17.502 5.76562 17.5957C5.67188 17.6895 5.59863 17.8271 5.5459 18.0088C5.49316 18.1963 5.43164 18.457 5.36133 18.791C5.34375 18.9141 5.27344 18.9756 5.15039 18.9756Z"
              fill="currentColor"
            />
          </svg>
          <span>Effects</span>
        </button>
          <button className={`text-action-button text-action-button--quick-edit${activeBottomLeftMenu === 'quickEdit' ? ' active' : ''}`} type="button" aria-label="Quick Edit" onClick={() => toggleBottomLeftMenu('quickEdit')}>
          <span>Quick Edit</span>
          <svg className="text-action-glyph chevron-glyph" viewBox="0 0 9 5" aria-hidden="true">
            <path
              d="M4.32617 4.9707C4.16341 4.9707 4.0153 4.9056 3.88184 4.77539L0.166016 0.97168C0.110677 0.919596 0.0683594 0.861003 0.0390625 0.795898C0.0130208 0.727539 0 0.654297 0 0.576172C0 0.46875 0.0244141 0.371094 0.0732422 0.283203C0.125326 0.195312 0.193685 0.126953 0.27832 0.078125C0.362956 0.0260417 0.458984 0 0.566406 0C0.722656 0 0.859375 0.0585938 0.976562 0.175781L4.56543 3.85254H4.0918L7.67578 0.175781C7.79297 0.0585938 7.92969 0 8.08594 0C8.19336 0 8.28939 0.0260417 8.37402 0.078125C8.45866 0.126953 8.52539 0.195312 8.57422 0.283203C8.6263 0.371094 8.65234 0.46875 8.65234 0.576172C8.65234 0.729167 8.59701 0.861003 8.48633 0.97168L4.77051 4.77539C4.70866 4.84049 4.6403 4.88932 4.56543 4.92188C4.49056 4.95443 4.41081 4.9707 4.32617 4.9707Z"
              fill="currentColor"
            />
          </svg>
          </button>
        </nav>
      </div>
      <nav className="composer" style={{ bottom: `${controlsBottomPx}px` }} aria-label="Composer">
        <button className="composer-more-button" type="button" aria-label="More menu">
          <svg className="composer-more-glyph" viewBox="0 0 13 3" aria-hidden="true">
            <path
              d="M1.29883 2.59082C1.05729 2.59082 0.838542 2.53385 0.642578 2.41992C0.446615 2.30143 0.289388 2.14421 0.170898 1.94824C0.0569661 1.75228 0 1.53581 0 1.29883C0 1.05729 0.0569661 0.838542 0.170898 0.642578C0.289388 0.446615 0.446615 0.291667 0.642578 0.177734C0.838542 0.0592448 1.05729 0 1.29883 0C1.53581 0 1.75228 0.0592448 1.94824 0.177734C2.14421 0.291667 2.29915 0.446615 2.41309 0.642578C2.53158 0.838542 2.59082 1.05729 2.59082 1.29883C2.59082 1.53581 2.53158 1.75228 2.41309 1.94824C2.29915 2.14421 2.14421 2.30143 1.94824 2.41992C1.75228 2.53385 1.53581 2.59082 1.29883 2.59082ZM6.37793 2.59082C6.13639 2.59082 5.91764 2.53385 5.72168 2.41992C5.52572 2.30143 5.36849 2.14421 5.25 1.94824C5.13607 1.75228 5.0791 1.53581 5.0791 1.29883C5.0791 1.05729 5.13607 0.838542 5.25 0.642578C5.36849 0.446615 5.52572 0.291667 5.72168 0.177734C5.91764 0.0592448 6.13639 0 6.37793 0C6.61491 0 6.83138 0.0592448 7.02734 0.177734C7.22331 0.291667 7.37826 0.446615 7.49219 0.642578C7.61068 0.838542 7.66992 1.05729 7.66992 1.29883C7.66992 1.53581 7.61068 1.75228 7.49219 1.94824C7.37826 2.14421 7.22331 2.30143 7.02734 2.41992C6.83138 2.53385 6.61491 2.59082 6.37793 2.59082ZM11.457 2.59082C11.2155 2.59082 10.9967 2.53385 10.8008 2.41992C10.6048 2.30143 10.4476 2.14421 10.3291 1.94824C10.2152 1.75228 10.1582 1.53581 10.1582 1.29883C10.1582 1.05729 10.2152 0.838542 10.3291 0.642578C10.4476 0.446615 10.6048 0.291667 10.8008 0.177734C10.9967 0.0592448 11.2155 0 11.457 0C11.694 0 11.9105 0.0592448 12.1064 0.177734C12.3024 0.291667 12.4596 0.446615 12.5781 0.642578C12.6966 0.838542 12.7559 1.05729 12.7559 1.29883C12.7559 1.53581 12.6966 1.75228 12.5781 1.94824C12.4596 2.14421 12.3024 2.30143 12.1064 2.41992C11.9105 2.53385 11.694 2.59082 11.457 2.59082Z"
              fill="currentColor"
            />
          </svg>
        </button>
        {isComposerAddMenuOpen && (
          <section
            ref={addMenuRef}
            className="composer-add-menu"
            style={{
              left: `${addMenuPosition.left}px`,
              top: `${addMenuPosition.top}px`,
              height: `${addMenuFixedHeight}px`,
            }}
            aria-label="Add menu"
          >
            <div className="composer-add-menu-content">
              {!isAddMenuReferenceBrowserOpen ? (
                <>
                  <p className="composer-add-recents-title">RECENT</p>
                  <div className="composer-add-recents" aria-label="Recent references">
                    {recentReferenceThumbnails.map((thumbnail) => (
                      <button key={thumbnail.name} className="composer-add-recent-button" type="button" aria-label={thumbnail.name}>
                        <img className="composer-add-recent-image" src={thumbnail.src} alt={thumbnail.name} />
                      </button>
                    ))}
                  </div>
                  <div className="composer-add-action-list" aria-label="Add menu actions">
                    <button className="composer-add-action-button" type="button" onClick={() => handleOpenAddMenuSourceBrowser('references')}>
                      <img className="composer-add-action-glyph" src={referenceGlyph} alt="" aria-hidden="true" />
                      <span>References</span>
                    </button>
                    <button className="composer-add-action-button" type="button" onClick={() => handleOpenAddMenuSourceBrowser('webSearch')}>
                      <img className="composer-add-action-glyph" src={webGlyph} alt="" aria-hidden="true" />
                      <span>Web Search</span>
                    </button>
                    <button className="composer-add-action-button" type="button">
                      <img className="composer-add-action-glyph" src={cameraGlyph} alt="" aria-hidden="true" />
                      <span>Take Photo</span>
                    </button>
                    <button className="composer-add-action-button" type="button">
                      <img className="composer-add-action-glyph" src={shareGlyph} alt="" aria-hidden="true" />
                      <span>Upload</span>
                    </button>
                  </div>
                </>
              ) : (
              <section className="composer-source-browser" aria-label="References and web search browser">
                <div className="composer-source-segmented-control" role="tablist" aria-label="Source type">
                  <button
                    className={`composer-source-segmented-option${addMenuSourceTab === 'references' ? ' active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={addMenuSourceTab === 'references'}
                    onClick={() => setAddMenuSourceTab('references')}
                  >
                    References
                  </button>
                  <button
                    className={`composer-source-segmented-option${addMenuSourceTab === 'webSearch' ? ' active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={addMenuSourceTab === 'webSearch'}
                    onClick={() => setAddMenuSourceTab('webSearch')}
                  >
                    Web Search
                  </button>
                </div>
                <div className="composer-source-search-field">
                  <img className="composer-source-search-left-glyph" src={searchGlyph} alt="" aria-hidden="true" />
                  <input
                    className="composer-source-search-input"
                    type="text"
                    value={addMenuSearchQuery}
                    onChange={(event) => setAddMenuSearchQuery(event.target.value)}
                    placeholder={addMenuSourceTab === 'references' ? 'Search references' : 'Search web'}
                    aria-label={addMenuSourceTab === 'references' ? 'Search references' : 'Search web'}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' || addMenuSourceTab !== 'webSearch') {
                        return
                      }
                      event.preventDefault()
                      void handleRunPexelsWebSearch()
                    }}
                  />
                  {addMenuSearchQuery.length > 0 && (
                    <button
                      className="composer-source-search-clear-button"
                      type="button"
                      aria-label="Clear search"
                      onClick={() => setAddMenuSearchQuery('')}
                    >
                      <img className="composer-source-search-clear-glyph" src={closeGlyph} alt="" aria-hidden="true" />
                    </button>
                  )}
                </div>
                {addMenuSourceTab === 'references' ? (
                  <div className="composer-source-grid" aria-label="Reference thumbnails">
                    {filteredReferenceThumbnails.map((thumbnail) => (
                      <button key={`source-${thumbnail.name}`} className="composer-source-grid-item" type="button" aria-label={thumbnail.name}>
                        <img className="composer-source-grid-image" src={thumbnail.src} alt={thumbnail.name} />
                        <span className="composer-source-grid-name">{thumbnail.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    {isWebSearchLoading && <p className="composer-source-status">Searching Pexels...</p>}
                    {webSearchError && <p className="composer-source-status composer-source-status--error">{webSearchError}</p>}
                    {!isWebSearchLoading && !webSearchError && hasWebSearchPerformed && webSearchResults.length === 0 && (
                      <p className="composer-source-status">No results found.</p>
                    )}
                    {!isWebSearchLoading && webSearchResults.length === 0 && (
                      <div className="composer-source-past-searches" aria-label="Past searches">
                        {prototypePastWebSearches.map((searchTerm) => (
                          <button
                            key={searchTerm}
                            className="composer-source-past-search-button"
                            type="button"
                            onClick={() => {
                              void handleRunPexelsWebSearch(searchTerm)
                            }}
                          >
                            {searchTerm}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isWebSearchLoading && !webSearchError && webSearchResults.length > 0 && (
                      <div className="composer-source-grid" aria-label="Web search thumbnails">
                        {webSearchResults.map((thumbnail) => (
                          <button key={`web-${thumbnail.id}`} className="composer-source-grid-item" type="button" aria-label={thumbnail.name}>
                            <img className="composer-source-grid-image" src={thumbnail.src} alt={thumbnail.name} />
                            <span className="composer-source-grid-name">{thumbnail.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
              )}
            </div>
          </section>
        )}
        <div className={`composer-input-shell${pendingEditCount > 0 ? ' composer-input-shell--has-pending-pill' : ''}`}>
          {pendingEditCount > 0 && (
            <>
              <button
                className="composer-pending-pill"
                data-pending-edits-trigger="true"
                type="button"
                aria-label={`${pendingEditCount} pending edits`}
                onClick={() => setIsPendingEditsMenuOpen((previous) => !previous)}
              >
                {pendingEditCount} Pending Edit{pendingEditCount === 1 ? '' : 's'}
              </button>
              {isPendingEditsMenuOpen && (
                <section ref={pendingEditsMenuRef} className="composer-pending-menu" aria-label="Pending edits">
                  {pendingEdits.map((pendingEdit) => (
                    <div key={pendingEdit.id} className="composer-pending-item">
                      {pendingEditThumbnailSrcById[pendingEdit.id] ? (
                        <img
                          className="composer-pending-thumbnail"
                          src={pendingEditThumbnailSrcById[pendingEdit.id]}
                          alt=""
                          aria-hidden="true"
                        />
                      ) : (
                        <div className="composer-pending-thumbnail composer-pending-thumbnail--placeholder" aria-hidden="true" />
                      )}
                      <span className="composer-pending-item-text">{pendingEdit.text}</span>
                      <button
                        className="composer-pending-trash-wrap"
                        type="button"
                        aria-label={`Delete pending edit: ${pendingEdit.text}`}
                        onClick={() => handleDeleteComment(pendingEdit.id)}
                      >
                        <img className="composer-pending-trash" src={trashGlyph} alt="" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          <button className="composer-chevron-button" type="button" aria-label="Collapse composer">
            <svg className="composer-chevron-up-glyph" viewBox="0 0 9 5" aria-hidden="true">
              <path
                d="M0.166016 4.00391L3.88184 0.200195C4.00879 0.0667318 4.1569 0 4.32617 0C4.41081 0.00325521 4.49056 0.0227865 4.56543 0.0585938C4.6403 0.0911458 4.70866 0.138346 4.77051 0.200195L8.48633 4.00391C8.59701 4.11133 8.65234 4.24479 8.65234 4.4043C8.65234 4.51172 8.6263 4.60775 8.57422 4.69238C8.52539 4.77702 8.45866 4.84538 8.37402 4.89746C8.28939 4.94954 8.19336 4.97559 8.08594 4.97559C7.92318 4.97559 7.78646 4.91699 7.67578 4.7998L4.0918 1.12793H4.56543L0.976562 4.7998C0.869141 4.91699 0.732422 4.97559 0.566406 4.97559C0.458984 4.97559 0.362956 4.94954 0.27832 4.89746C0.193685 4.84538 0.125326 4.77702 0.0732422 4.69238C0.0244141 4.60775 0 4.51172 0 4.4043C0 4.32617 0.0130208 4.25293 0.0390625 4.18457C0.0683594 4.11621 0.110677 4.05599 0.166016 4.00391Z"
                fill="currentColor"
              />
            </svg>
          </button>
          <input
            className={`composer-input${isReveRendering ? ' composer-input--rendering' : ''}`}
            type="text"
            value={isReveRendering ? '' : composerInput}
            onChange={(event) => setComposerInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !canRender) {
                return
              }
              event.preventDefault()
              void handleRender()
            }}
            placeholder={isReveRendering ? '' : pendingEditCount > 0 ? '' : 'Ask Reve'}
            aria-label="Composer input"
            readOnly={isReveRendering}
          />
          {isReveRendering && <span className="composer-rendering-text" aria-hidden="true">Rendering</span>}
          <button
            className="composer-add-button"
            data-add-menu-trigger="true"
            type="button"
            aria-label="Add change"
            onClick={handleAddMenuTriggerClick}
          >
            <svg className="composer-add-glyph" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="0.5" y="0.5" width="19" height="19" rx="9.5" fill="none" stroke="currentColor" />
              <path
                d="M10.3555 14.082C10.3555 14.2227 10.3027 14.3438 10.1973 14.4453C10.0957 14.5508 9.97266 14.6035 9.82812 14.6035C9.68359 14.6035 9.56055 14.5508 9.45898 14.4453C9.35742 14.3438 9.30664 14.2227 9.30664 14.082V5.45703C9.30664 5.31641 9.35742 5.19531 9.45898 5.09375C9.56055 4.98828 9.68359 4.93555 9.82812 4.93555C9.97266 4.93555 10.0957 4.98828 10.1973 5.09375C10.3027 5.19531 10.3555 5.31641 10.3555 5.45703V14.082ZM5.51562 10.291C5.375 10.291 5.25195 10.2402 5.14648 10.1387C5.04492 10.0371 4.99414 9.91406 4.99414 9.76953C4.99414 9.625 5.04492 9.50195 5.14648 9.40039C5.25195 9.29492 5.375 9.24219 5.51562 9.24219H14.1406C14.2812 9.24219 14.4023 9.29492 14.5039 9.40039C14.6094 9.50195 14.6621 9.625 14.6621 9.76953C14.6621 9.91406 14.6094 10.0371 14.5039 10.1387C14.4023 10.2402 14.2812 10.291 14.1406 10.291H5.51562Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        <button
          className={`composer-render-button${canRender ? ' active' : ''}`}
          type="button"
          aria-label="Render"
          disabled={!canRender}
          onClick={() => {
            void handleRender()
          }}
        >
          Render
        </button>
      </nav>
      {hasRenderHistory && (
        <section
          className="render-filmstrip"
          style={{ bottom: `${filmstripBottomGapPx}px`, height: `${filmstripThumbnailHeightPx}px` }}
          aria-label="Render history"
        >
          <div className="render-filmstrip-track">
            {renderHistory.map((historyImage) => (
              <button
                key={historyImage.id}
                className={`render-filmstrip-item${historyImage.src === displayImageSrc ? ' active' : ''}`}
                type="button"
                aria-label="Load render"
                onClick={() => {
                  setDisplayImageSrc(historyImage.src)
                  setSourceImageLoaded(false)
                }}
              >
                <img className="render-filmstrip-image" src={historyImage.src} alt="" aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}
      {reveRenderError && <p className="composer-render-error">{reveRenderError}</p>}
      <main className="image-stage">
        <div
          ref={imageFrameRef}
          className={`image-frame${selectedTool === 'commentDraw' ? ' image-frame--comment' : ''}${isInteractionMenuOpen ? ' image-frame--interaction-locked' : ''}`}
          onMouseMove={handleImageMouseMove}
          onMouseLeave={handleImageMouseLeave}
          onClick={handleImageClick}
          onPointerDown={handleImagePointerDown}
          onPointerMove={handleImagePointerMove}
          onPointerUp={handleImagePointerUp}
          onPointerCancel={handleImagePointerCancel}
        >
          <img
            ref={sourceImageRef}
            src={displayImageSrc}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
            onLoad={() => setSourceImageLoaded(true)}
          />
          {hasNoAdjustments(adjustSliderValues) ? (
            <img
              className={`hero-image${isReveRendering ? ' hero-image--rendering' : ''}${renderRevealTransition ? ' hero-image--transition-hidden' : ''}`}
              src={displayImageSrc}
              alt="Mont Blanc trail landscape"
              draggable={false}
            />
          ) : (
            <canvas
              ref={heroWebGLCanvasRef}
              className={`hero-image${isReveRendering ? ' hero-image--rendering' : ''}${renderRevealTransition ? ' hero-image--transition-hidden' : ''}`}
              aria-label="Mont Blanc trail landscape with adjustments"
            />
          )}
          {renderRevealTransition && (
            <div className="hero-image-reveal-layer" aria-hidden="true">
              <img
                className="hero-image-reveal hero-image-reveal--old"
                src={renderRevealTransition.previousImageSrc}
                alt=""
                style={
                  {
                    '--render-reveal-starting-blur': `${renderRevealTransition.startingBlurPx}px`,
                  } as CSSProperties
                }
              />
              <img
                className="hero-image-reveal hero-image-reveal--new"
                src={renderRevealTransition.nextImageSrc}
                alt=""
                style={
                  {
                    '--render-reveal-starting-blur': `${renderRevealTransition.startingBlurPx}px`,
                  } as CSSProperties
                }
              />
            </div>
          )}
          <div className="object-overlays" aria-label="Object overlays">
            {showObjectOverlays &&
              imageObjects.map((imageObject) => (
                <div
                  key={imageObject.name}
                  className="object-box"
                  style={getObjectBoxStyle(imageObject)}
                >
                  <span className="object-box-label">{imageObject.name}</span>
                </div>
              ))}
            {selectedImageObject && (
              <div className="object-hover-corners" style={getObjectBoxStyle(selectedImageObject)}>
                <img
                  className="object-corner-marker object-corner-marker--static object-corner-marker-tl"
                  src={boundingBoxTl}
                  alt=""
                  style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                />
                <img
                  className="object-corner-marker object-corner-marker--static object-corner-marker-tr"
                  src={boundingBoxTr}
                  alt=""
                  style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                />
                <img
                  className="object-corner-marker object-corner-marker--static object-corner-marker-bl"
                  src={boundingBoxBl}
                  alt=""
                  style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                />
                <img
                  className="object-corner-marker object-corner-marker--static object-corner-marker-br"
                  src={boundingBoxBr}
                  alt=""
                  style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                />
              </div>
            )}
            {transientHighlightedObject && (!selectedImageObject || transientHighlightedObject.name !== selectedImageObject.name) && (() => {
              const isFromList = transientHighlightedObjectName === hoveredObjectListName
              const staticClass = isFromList ? ' object-corner-marker--static' : ''
              return (
                <div key={transientHighlightedObject.name} className="object-hover-corners" style={getObjectBoxStyle(transientHighlightedObject)}>
                  <img
                    className={`object-corner-marker object-corner-marker-tl${staticClass}`}
                    src={boundingBoxTl}
                    alt=""
                    style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                  />
                  <img
                    className={`object-corner-marker object-corner-marker-tr${staticClass}`}
                    src={boundingBoxTr}
                    alt=""
                    style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                  />
                  <img
                    className={`object-corner-marker object-corner-marker-bl${staticClass}`}
                    src={boundingBoxBl}
                    alt=""
                    style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                  />
                  <img
                    className={`object-corner-marker object-corner-marker-br${staticClass}`}
                    src={boundingBoxBr}
                    alt=""
                    style={{ width: `${hoverCornerMarkerSize}px`, height: `${hoverCornerMarkerSize}px` }}
                  />
                </div>
              )
            })()}
          </div>
          <div
            ref={commentLayerRef}
            className="comment-layer"
            aria-label="Comment annotations"
            onPointerDown={(e) => {
              const el = e.target as Element
              if (
                el.closest?.('.comment-point, .comment-collapsed-chip') ||
                (el.tagName === 'path' && el.classList?.contains('comment-stroke') && !el.classList?.contains('comment-stroke--draft'))
              ) {
                e.stopPropagation()
              }
            }}
            onPointerUp={(e) => {
              const el = e.target as Element
              if (
                el.closest?.('.comment-point, .comment-collapsed-chip') ||
                (el.tagName === 'path' && el.classList?.contains('comment-stroke') && !el.classList?.contains('comment-stroke--draft'))
              ) {
                e.stopPropagation()
              }
            }}
            onPointerMove={(e) => {
              const el = e.target as Element
              if (
                el.closest?.('.comment-point, .comment-collapsed-chip') ||
                (el.tagName === 'path' && el.classList?.contains('comment-stroke') && !el.classList?.contains('comment-stroke--draft'))
              ) {
                e.stopPropagation()
              }
            }}
            onPointerCancel={(e) => {
              const el = e.target as Element
              if (
                el.closest?.('.comment-point, .comment-collapsed-chip') ||
                (el.tagName === 'path' && el.classList?.contains('comment-stroke') && !el.classList?.contains('comment-stroke--draft'))
              ) {
                e.stopPropagation()
              }
            }}
          >
            <svg className="comment-strokes" viewBox={`0 0 ${sourceImageSize.width} ${sourceImageSize.height}`} preserveAspectRatio="none" aria-hidden="true">
              {commentAnnotations
                .filter((comment) => comment.kind === 'stroke' && comment.strokePoints.length > 1)
                .map((comment) => (
                  <path
                    key={comment.id}
                    className="comment-stroke"
                    d={getCommentStrokePathData(comment.strokePoints)}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      if (!imageFrameRef.current) {
                        return
                      }
                      openCommentPanel(comment.id, imageFrameRef.current.getBoundingClientRect())
                    }}
                  />
                ))}
              {isDrawingCommentStroke && draftCommentStrokePoints.length > 1 && (
                <path className="comment-stroke comment-stroke--draft" d={getCommentStrokePathData(draftCommentStrokePoints)} />
              )}
              {draftCommentBoxStart !== null && draftCommentBoxEnd !== null && (
                <path
                  className="comment-stroke comment-stroke--draft"
                  d={getCommentStrokePathData(getRectStrokePoints(draftCommentBoxStart, draftCommentBoxEnd))}
                />
              )}
            </svg>
            {commentAnnotations
              .filter((comment) => comment.kind === 'point')
              .map((comment) => (
                <button
                  key={comment.id}
                  className={`comment-point${comment.panelState === 'expanded' ? ' active' : ''}`}
                  style={sourcePointToPercent(comment.point)}
                  type="button"
                  onClick={() => {
                    if (!imageFrameRef.current) {
                      return
                    }
                    openCommentPanel(comment.id, imageFrameRef.current.getBoundingClientRect())
                  }}
                />
              ))}
            {commentAnnotations
              .filter((comment) => comment.panelState === 'collapsed' && comment.text.trim().length > 0)
              .map((comment) => (
                <button
                  key={`${comment.id}-collapsed`}
                  className="comment-collapsed-chip"
                  style={sourcePointToPercent(getCommentAnchorPoint(comment))}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!imageFrameRef.current) {
                      return
                    }
                    openCommentPanel(comment.id, imageFrameRef.current.getBoundingClientRect())
                  }}
                >
                  {comment.text.trim().slice(0, 10)}
                </button>
              ))}
          </div>
        </div>
        {hoveredObjectName && (
          <div
            className="image-hover-tooltip"
            style={{
              left: `${hoverTooltipPosition.x + 10}px`,
              top: `${hoverTooltipPosition.y + 10}px`,
            }}
          >
            {hoveredObjectName}
          </div>
        )}
        {selectedTool === 'commentDraw' && showCommentCursorHint && (
          <div
            className="comment-cursor-hint"
            style={{
              left: `${commentCursorPosition.x + 29}px`,
              top: `${commentCursorPosition.y - 12}px`,
            }}
          >
            Change this...
          </div>
        )}
        {activeComment && (
          <section
            ref={commentPanelRef}
            className="comment-panel"
            style={{
              left: `${commentPanelPosition.left}px`,
              top: `${commentPanelPosition.top}px`,
            }}
            aria-label="Comment panel"
          >
            <div className="comment-panel-content">
              <textarea
                ref={commentTextareaRef}
                className="comment-panel-input"
                placeholder={commentTextPlaceholder}
                value={activeComment.text}
                onKeyDown={handleCommentInputKeyDown}
                onChange={(event) =>
                  setCommentAnnotations((previous) =>
                    previous.map((comment) => (comment.id === activeComment.id ? { ...comment, text: event.target.value } : comment)),
                  )
                }
              />
              <div className="comment-panel-actions">
                <button
                  className="object-prompt-glyph-button"
                  data-add-menu-trigger="true"
                  type="button"
                  aria-label="Add comment"
                  onClick={handleAddMenuTriggerClick}
                >
                  <svg className="object-prompt-glyph" viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="0.5" y="0.5" width="19" height="19" rx="9.5" fill="none" stroke="currentColor" />
                    <path
                      d="M10.3555 14.082C10.3555 14.2227 10.3027 14.3438 10.1973 14.4453C10.0957 14.5508 9.97266 14.6035 9.82812 14.6035C9.68359 14.6035 9.56055 14.5508 9.45898 14.4453C9.35742 14.3438 9.30664 14.2227 9.30664 14.082V5.45703C9.30664 5.31641 9.35742 5.19531 9.45898 5.09375C9.56055 4.98828 9.68359 4.93555 9.82812 4.93555C9.97266 4.93555 10.0957 4.98828 10.1973 5.09375C10.3027 5.19531 10.3555 5.31641 10.3555 5.45703V14.082ZM5.51562 10.291C5.375 10.291 5.25195 10.2402 5.14648 10.1387C5.04492 10.0371 4.99414 9.91406 4.99414 9.76953C4.99414 9.625 5.04492 9.50195 5.14648 9.40039C5.25195 9.29492 5.375 9.24219 5.51562 9.24219H14.1406C14.2812 9.24219 14.4023 9.29492 14.5039 9.40039C14.6094 9.50195 14.6621 9.625 14.6621 9.76953C14.6621 9.91406 14.6094 10.0371 14.5039 10.1387C14.4023 10.2402 14.2812 10.291 14.1406 10.291H5.51562Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <button
                  className="object-prompt-glyph-button"
                  type="button"
                  aria-label="Delete comment"
                  onClick={() => handleDeleteComment(activeComment.id)}
                >
                  <svg className="object-prompt-glyph object-prompt-glyph-trash" viewBox="0 0 14 16" aria-hidden="true">
                    <path
                      d="M4.73047 13.1104C4.58919 13.1104 4.47526 13.0716 4.38867 12.9941C4.30208 12.9121 4.25651 12.8027 4.25195 12.666L4.04688 5.50195C4.04232 5.36979 4.08333 5.2627 4.16992 5.18066C4.25651 5.09408 4.37044 5.05078 4.51172 5.05078C4.65299 5.05078 4.76693 5.0918 4.85352 5.17383C4.9401 5.25586 4.9834 5.36296 4.9834 5.49512L5.19531 12.6592C5.19531 12.7959 5.15202 12.9053 5.06543 12.9873C4.9834 13.0693 4.87174 13.1104 4.73047 13.1104ZM6.74023 13.1104C6.59896 13.1104 6.48275 13.0693 6.3916 12.9873C6.30501 12.9053 6.26172 12.7982 6.26172 12.666V5.50195C6.26172 5.36979 6.30501 5.2627 6.3916 5.18066C6.48275 5.09408 6.59896 5.05078 6.74023 5.05078C6.88607 5.05078 7.00228 5.09408 7.08887 5.18066C7.18001 5.2627 7.22559 5.36979 7.22559 5.50195V12.666C7.22559 12.7982 7.18001 12.9053 7.08887 12.9873C7.00228 13.0693 6.88607 13.1104 6.74023 13.1104ZM8.75684 13.1104C8.611 13.1104 8.49479 13.0693 8.4082 12.9873C8.32617 12.9053 8.28743 12.7959 8.29199 12.6592L8.49707 5.50195C8.50163 5.36523 8.5472 5.25586 8.63379 5.17383C8.72038 5.0918 8.83203 5.05078 8.96875 5.05078C9.11458 5.05078 9.22852 5.09408 9.31055 5.18066C9.39714 5.2627 9.43815 5.36979 9.43359 5.50195L9.22852 12.666C9.22396 12.8027 9.17839 12.9121 9.0918 12.9941C9.00521 13.0716 8.89355 13.1104 8.75684 13.1104ZM3.63672 3.14355V1.66699C3.63672 1.1429 3.79395 0.735026 4.1084 0.443359C4.42741 0.147135 4.86947 -0.000976562 5.43457 -0.000976562H8.03223C8.59733 -0.000976562 9.03939 0.147135 9.3584 0.443359C9.67741 0.735026 9.83691 1.1429 9.83691 1.66699V3.14355H8.57227V1.72852C8.57227 1.55534 8.5153 1.41634 8.40137 1.31152C8.28743 1.20215 8.13477 1.14746 7.94336 1.14746H5.52344C5.33659 1.14746 5.1862 1.20215 5.07227 1.31152C4.95833 1.41634 4.90137 1.55534 4.90137 1.72852V3.14355H3.63672ZM0.608398 3.89551C0.439779 3.89551 0.296224 3.83626 0.177734 3.71777C0.0592448 3.59928 0 3.45573 0 3.28711C0 3.12305 0.0592448 2.98405 0.177734 2.87012C0.296224 2.75163 0.439779 2.69238 0.608398 2.69238H12.8789C13.0475 2.69238 13.1888 2.74935 13.3027 2.86328C13.4212 2.97721 13.4805 3.11849 13.4805 3.28711C13.4805 3.45573 13.4212 3.59928 13.3027 3.71777C13.1888 3.83626 13.0475 3.89551 12.8789 3.89551H0.608398ZM3.60254 15.4277C3.07389 15.4277 2.65007 15.2796 2.33105 14.9834C2.0166 14.6872 1.84798 14.2747 1.8252 13.7461L1.34668 3.76562H2.59766L3.06934 13.5342C3.07845 13.7347 3.14453 13.8988 3.26758 14.0264C3.39062 14.154 3.54785 14.2178 3.73926 14.2178H9.74121C9.93262 14.2178 10.0898 14.154 10.2129 14.0264C10.3359 13.9033 10.402 13.7393 10.4111 13.5342L10.8623 3.76562H12.1338L11.6621 13.7393C11.6393 14.2679 11.4684 14.6803 11.1494 14.9766C10.8304 15.2773 10.4089 15.4277 9.88477 15.4277H3.60254Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </section>
        )}
        {displayedObjectPrompt && (
          <section
            key={`${displayedObjectPrompt.name}-${objectPromptAnimationKey}`}
            ref={objectPromptPanelRef}
            className={`object-prompt-panel${isObjectPromptClosing ? ' object-prompt-panel--closing' : ''}`}
            style={{
              left: `${objectPromptPanelPosition.left}px`,
              top: `${objectPromptPanelPosition.top}px`,
              ['--object-prompt-from-x' as string]: `${objectPromptFromOffset.x}px`,
              ['--object-prompt-from-y' as string]: `${objectPromptFromOffset.y}px`,
            }}
            aria-label={`${displayedObjectPrompt.name} prompt`}
          >
            <div className="object-prompt-header">
              <h3 className="object-prompt-title">{displayedObjectPrompt.name}</h3>
              <div className="object-prompt-glyphs">
                <button
                  className="object-prompt-glyph-button"
                  data-add-menu-trigger="true"
                  type="button"
                  aria-label="Add object prompt"
                  onClick={handleAddMenuTriggerClick}
                >
                  <svg className="object-prompt-glyph" viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="0.5" y="0.5" width="19" height="19" rx="9.5" fill="none" stroke="currentColor" />
                    <path
                      d="M10.3555 14.082C10.3555 14.2227 10.3027 14.3438 10.1973 14.4453C10.0957 14.5508 9.97266 14.6035 9.82812 14.6035C9.68359 14.6035 9.56055 14.5508 9.45898 14.4453C9.35742 14.3438 9.30664 14.2227 9.30664 14.082V5.45703C9.30664 5.31641 9.35742 5.19531 9.45898 5.09375C9.56055 4.98828 9.68359 4.93555 9.82812 4.93555C9.97266 4.93555 10.0957 4.98828 10.1973 5.09375C10.3027 5.19531 10.3555 5.31641 10.3555 5.45703V14.082ZM5.51562 10.291C5.375 10.291 5.25195 10.2402 5.14648 10.1387C5.04492 10.0371 4.99414 9.91406 4.99414 9.76953C4.99414 9.625 5.04492 9.50195 5.14648 9.40039C5.25195 9.29492 5.375 9.24219 5.51562 9.24219H14.1406C14.2812 9.24219 14.4023 9.29492 14.5039 9.40039C14.6094 9.50195 14.6621 9.625 14.6621 9.76953C14.6621 9.91406 14.6094 10.0371 14.5039 10.1387C14.4023 10.2402 14.2812 10.291 14.1406 10.291H5.51562Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
                <button className="object-prompt-glyph-button" type="button" aria-label="Delete object prompt">
                  <svg className="object-prompt-glyph object-prompt-glyph-trash" viewBox="0 0 14 16" aria-hidden="true">
                    <path
                      d="M4.73047 13.1104C4.58919 13.1104 4.47526 13.0716 4.38867 12.9941C4.30208 12.9121 4.25651 12.8027 4.25195 12.666L4.04688 5.50195C4.04232 5.36979 4.08333 5.2627 4.16992 5.18066C4.25651 5.09408 4.37044 5.05078 4.51172 5.05078C4.65299 5.05078 4.76693 5.0918 4.85352 5.17383C4.9401 5.25586 4.9834 5.36296 4.9834 5.49512L5.19531 12.6592C5.19531 12.7959 5.15202 12.9053 5.06543 12.9873C4.9834 13.0693 4.87174 13.1104 4.73047 13.1104ZM6.74023 13.1104C6.59896 13.1104 6.48275 13.0693 6.3916 12.9873C6.30501 12.9053 6.26172 12.7982 6.26172 12.666V5.50195C6.26172 5.36979 6.30501 5.2627 6.3916 5.18066C6.48275 5.09408 6.59896 5.05078 6.74023 5.05078C6.88607 5.05078 7.00228 5.09408 7.08887 5.18066C7.18001 5.2627 7.22559 5.36979 7.22559 5.50195V12.666C7.22559 12.7982 7.18001 12.9053 7.08887 12.9873C7.00228 13.0693 6.88607 13.1104 6.74023 13.1104ZM8.75684 13.1104C8.611 13.1104 8.49479 13.0693 8.4082 12.9873C8.32617 12.9053 8.28743 12.7959 8.29199 12.6592L8.49707 5.50195C8.50163 5.36523 8.5472 5.25586 8.63379 5.17383C8.72038 5.0918 8.83203 5.05078 8.96875 5.05078C9.11458 5.05078 9.22852 5.09408 9.31055 5.18066C9.39714 5.2627 9.43815 5.36979 9.43359 5.50195L9.22852 12.666C9.22396 12.8027 9.17839 12.9121 9.0918 12.9941C9.00521 13.0716 8.89355 13.1104 8.75684 13.1104ZM3.63672 3.14355V1.66699C3.63672 1.1429 3.79395 0.735026 4.1084 0.443359C4.42741 0.147135 4.86947 -0.000976562 5.43457 -0.000976562H8.03223C8.59733 -0.000976562 9.03939 0.147135 9.3584 0.443359C9.67741 0.735026 9.83691 1.1429 9.83691 1.66699V3.14355H8.57227V1.72852C8.57227 1.55534 8.5153 1.41634 8.40137 1.31152C8.28743 1.20215 8.13477 1.14746 7.94336 1.14746H5.52344C5.33659 1.14746 5.1862 1.20215 5.07227 1.31152C4.95833 1.41634 4.90137 1.55534 4.90137 1.72852V3.14355H3.63672ZM0.608398 3.89551C0.439779 3.89551 0.296224 3.83626 0.177734 3.71777C0.0592448 3.59928 0 3.45573 0 3.28711C0 3.12305 0.0592448 2.98405 0.177734 2.87012C0.296224 2.75163 0.439779 2.69238 0.608398 2.69238H12.8789C13.0475 2.69238 13.1888 2.74935 13.3027 2.86328C13.4212 2.97721 13.4805 3.11849 13.4805 3.28711C13.4805 3.45573 13.4212 3.59928 13.3027 3.71777C13.1888 3.83626 13.0475 3.89551 12.8789 3.89551H0.608398ZM3.60254 15.4277C3.07389 15.4277 2.65007 15.2796 2.33105 14.9834C2.0166 14.6872 1.84798 14.2747 1.8252 13.7461L1.34668 3.76562H2.59766L3.06934 13.5342C3.07845 13.7347 3.14453 13.8988 3.26758 14.0264C3.39062 14.154 3.54785 14.2178 3.73926 14.2178H9.74121C9.93262 14.2178 10.0898 14.154 10.2129 14.0264C10.3359 13.9033 10.402 13.7393 10.4111 13.5342L10.8623 3.76562H12.1338L11.6621 13.7393C11.6393 14.2679 11.4684 14.6803 11.1494 14.9766C10.8304 15.2773 10.4089 15.4277 9.88477 15.4277H3.60254Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <textarea
              ref={objectPromptTextareaRef}
              className="object-prompt-textarea"
              value={displayedObjectPromptText}
              placeholder={getObjectPromptText(displayedObjectPrompt.name)}
              onChange={(event) =>
                setObjectPromptTexts((previous) => ({
                  ...previous,
                  [displayedObjectPrompt.name]: event.target.value,
                }))
              }
            />
          </section>
        )}
      </main>
    </>
  )
}

export default App
