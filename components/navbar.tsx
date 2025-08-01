import { Sparkles } from "lucide-react"
import Link from "next/link"

export function Navbar() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-2xl">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-400 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
        </Link>
      </div>
    </header>
  )
}

