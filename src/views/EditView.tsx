import type { ReactNode } from 'react'

type EditViewProps = {
  children: ReactNode
  isChatOpen?: boolean
}

function EditView({ children, isChatOpen = false }: EditViewProps) {
  return <main className={`image-stage${isChatOpen ? ' image-stage--chat-open' : ''}`}>{children}</main>
}

export default EditView
