import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import '@fontsource-variable/geist/wght.css'
import { Header } from '../components/header'

import appCss from '../styles.css?url'
import favicon from '../assets/favicon.svg'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      { title: 'Translator App' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: favicon },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-gray-100">
        <Header />
        <main className="mt-[4.1875rem] mx-auto p-6 max-w-5xl flex flex-col gap-4">
          {children}
        </main>
        <Scripts />
      </body>
    </html>
  )
}