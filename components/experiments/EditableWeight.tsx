'use client'

import { useState } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EditableWeightProps {
  variantId: string
  initialWeight: number
  onUpdate: (variantId: string, newWeight: number) => Promise<void>
  disabled?: boolean
}

export function EditableWeight({
  variantId,
  initialWeight,
  onUpdate,
  disabled = false
}: EditableWeightProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [weight, setWeight] = useState(initialWeight.toString())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const newWeight = Number(weight)

    // Validation
    if (isNaN(newWeight) || newWeight < 0 || newWeight > 100) {
      setError('Weight must be between 0 and 100')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onUpdate(variantId, newWeight)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update weight')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setWeight(initialWeight.toString())
    setError(null)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{initialWeight}%</span>
        {!disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-7 w-7 p-0"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max="100"
          step="1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 w-20"
          autoFocus
          disabled={loading}
        />
        <span className="text-sm text-muted-foreground">%</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={loading}
          className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={loading}
          className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  )
}
