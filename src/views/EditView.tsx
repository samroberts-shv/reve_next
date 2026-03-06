import type { CSSProperties, ReactNode } from 'react'

type EditViewProps = {
  children: ReactNode
  isChatOpen?: boolean
  extraBottomPx?: number
}

function EditView({ children, isChatOpen = false, extraBottomPx = 0 }: EditViewProps) {
  return (
    <main
      className={`image-stage${isChatOpen ? ' image-stage--chat-open' : ''}`}
      style={{ '--stage-extra-bottom': `${extraBottomPx}px` } as CSSProperties}
    >
      {children}
    </main>
  )
}

export default EditView
