import type { ReactNode } from 'react'

type EditViewProps = {
  children: ReactNode
}

function EditView({ children }: EditViewProps) {
  return <main className="image-stage">{children}</main>
}

export default EditView
