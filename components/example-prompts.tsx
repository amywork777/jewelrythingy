import { Button } from "@/components/ui/button"
import { Lightbulb } from "lucide-react"

const EXAMPLE_PROMPTS = [
  "A detailed dragon with scales and wings",
  "A cute cartoon character with big eyes",
  "A futuristic robot with multiple arms",
  "A fantasy castle with towers and a moat",
  "A stylized tree with twisted branches",
]

interface ExamplePromptsProps {
  onExampleClick: (prompt: string) => void
}

export function ExamplePrompts({ onExampleClick }: ExamplePromptsProps) {
  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-medium">Example prompts:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="text-sm bg-gray-50 hover:bg-gray-100"
            onClick={() => onExampleClick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  )
}

