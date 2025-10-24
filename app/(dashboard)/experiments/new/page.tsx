'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Variant {
  id: string
  name: string
  displayName: string
  weight: number
  isControl: boolean
}

export default function NewExperimentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [variants, setVariants] = useState<Variant[]>([
    {
      id: 'control',
      name: 'control',
      displayName: 'Control (Original)',
      weight: 50,
      isControl: true,
    },
    {
      id: 'variant_a',
      name: 'variant_a',
      displayName: 'Variant A',
      weight: 50,
      isControl: false,
    },
  ])

  // Add new variant
  const addVariant = () => {
    const nextLetter = String.fromCharCode(65 + variants.length - 1) // B, C, D...
    const newVariant: Variant = {
      id: `variant_${nextLetter.toLowerCase()}`,
      name: `variant_${nextLetter.toLowerCase()}`,
      displayName: `Variant ${nextLetter}`,
      weight: Math.floor(100 / (variants.length + 1)),
      isControl: false,
    }

    // Redistribute weights
    const totalVariants = variants.length + 1
    const evenWeight = Math.floor(100 / totalVariants)
    const updatedVariants = variants.map((v) => ({ ...v, weight: evenWeight }))

    setVariants([...updatedVariants, newVariant])
  }

  // Remove variant
  const removeVariant = (id: string) => {
    if (variants.length <= 2) return // Must have at least 2 variants
    const filtered = variants.filter((v) => v.id !== id)

    // Redistribute weights
    const evenWeight = Math.floor(100 / filtered.length)
    const updated = filtered.map((v) => ({ ...v, weight: evenWeight }))

    setVariants(updated)
  }

  // Update variant
  const updateVariant = (id: string, field: keyof Variant, value: string | number) => {
    setVariants(
      variants.map((v) =>
        v.id === id ? { ...v, [field]: value } : v
      )
    )
  }

  // Update variant weight and redistribute
  const updateVariantWeight = (id: string, newWeight: number) => {
    const variant = variants.find((v) => v.id === id)
    if (!variant) return

    const otherVariants = variants.filter((v) => v.id !== id)
    const remainingWeight = 100 - newWeight
    const weightPerOther = remainingWeight / otherVariants.length

    setVariants(
      variants.map((v) =>
        v.id === id ? { ...v, weight: newWeight } : { ...v, weight: Math.round(weightPerOther) }
      )
    )
  }

  // Validate form
  const validateForm = () => {
    if (!name.trim()) return 'Experiment name is required'
    if (variants.length < 2) return 'At least 2 variants required'

    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)
    if (totalWeight !== 100) return `Total weight must be 100% (currently ${totalWeight}%)`

    return null
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          hypothesis,
          variants,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create experiment')
      }

      const { experiment } = await response.json()
      router.push(`/experiments/${experiment.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/experiments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Experiment</h1>
          <p className="text-muted-foreground">Set up your A/B test configuration</p>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Describe your experiment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Experiment Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Product CTA Button Test"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of what you're testing"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hypothesis">Hypothesis</Label>
              <Textarea
                id="hypothesis"
                placeholder="e.g., Changing the button color to green will increase conversions by 15%"
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Variants */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Variants</CardTitle>
                <CardDescription>
                  Configure your test variants and traffic allocation
                </CardDescription>
              </div>
              <Button type="button" onClick={addVariant} variant="outline" size="sm">
                <Plus className="h-4 w-4" />
                Add Variant
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {variants.map((variant, index) => (
              <div
                key={variant.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`variant-${variant.id}-name`}>
                          Display Name
                        </Label>
                        <Input
                          id={`variant-${variant.id}-name`}
                          value={variant.displayName}
                          onChange={(e) =>
                            updateVariant(variant.id, 'displayName', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`variant-${variant.id}-weight`}>
                          Traffic Allocation (%)
                        </Label>
                        <Input
                          id={`variant-${variant.id}-weight`}
                          type="number"
                          min="0"
                          max="100"
                          value={variant.weight}
                          onChange={(e) =>
                            updateVariantWeight(variant.id, parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>

                    {variant.isControl && (
                      <div className="text-sm text-muted-foreground">
                        ⭐ This is the control variant (original version)
                      </div>
                    )}
                  </div>

                  {!variant.isControl && variants.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariant(variant.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Weight visualization */}
                <div className="space-y-1">
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${variant.weight}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-muted-foreground">Total Allocation:</span>
              <span
                className={`text-sm font-medium ${
                  totalWeight === 100 ? 'text-green-600' : 'text-destructive'
                }`}
              >
                {totalWeight}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/experiments">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || totalWeight !== 100}>
            {loading ? 'Creating...' : 'Create Experiment'}
          </Button>
        </div>
      </form>
    </div>
  )
}
