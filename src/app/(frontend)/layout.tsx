import React from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata = {
  description: 'App luyện nói tiếng Anh thông minh với AI.',
  title: 'App luyện nói lộc làm cho mi đẹp gái',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="vi" className={plusJakartaSans.variable}>
      <body className={`${plusJakartaSans.className} bg-white text-gray-900 antialiased`}>
        <main>{children}</main>
      </body>
    </html>
  )
}
