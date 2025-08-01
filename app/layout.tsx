import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import TaiyakiProvider from "@/components/taiyaki-provider"

// Initialize Inter font with latin subset
const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
})

export const metadata: Metadata = {
  title: "3D Model Generator",
  description:
    "Create detailed 3D models from images or text descriptions. Perfect for characters, creatures, and organic shapes.",
  generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className={`${inter.className} bg-white`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TaiyakiProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}