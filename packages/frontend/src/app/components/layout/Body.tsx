import { FC, PropsWithChildren } from 'react'

const Body: FC<PropsWithChildren> = ({ children }) => {
  return (
    <main className="flex w-full flex-grow flex-col items-center overflow-x-hidden py-8">
      {children}
    </main>
  )
}
export default Body
