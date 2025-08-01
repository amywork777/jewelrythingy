import { ModelGenerator } from "../components/model-generator"
import { Toaster } from "../components/ui/toaster"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 container mx-auto py-12 px-4">
        <ModelGenerator />
      </div>
      <Toaster />
    </main>
  )
}

