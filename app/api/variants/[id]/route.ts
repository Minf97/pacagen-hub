import { NextResponse } from 'next/server'
import { updateVariant, getVariantById, getVariantsByExperimentId, getExperimentById, updateExperiment } from '@/lib/db/queries'

/**
 * PATCH /api/variants/[id] - Update variant
 * Used primarily for updating variant weight
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate weight if provided
    if (body.weight !== undefined) {
      const weight = Number(body.weight)
      if (isNaN(weight) || weight < 0 || weight > 100) {
        return NextResponse.json(
          { error: 'Weight must be between 0 and 100' },
          { status: 400 }
        )
      }
    }

    // Get current variant to check experimentId
    const currentVariant = await getVariantById(id)

    if (!currentVariant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    // Build update object (accept camelCase from frontend)
    const updateData: any = {}
    if (body.weight !== undefined) updateData.weight = Number(body.weight)
    if (body.displayName !== undefined) updateData.displayName = body.displayName
    if (body.config !== undefined) updateData.config = body.config

    // Update variant (only if validation passed)
    const variant = await updateVariant(id, updateData)

    // If weight was updated, sync trafficAllocation in experiment
    if (body.weight !== undefined) {
      const experiment = await getExperimentById(currentVariant.experimentId)

      if (experiment && experiment.trafficAllocation) {
        // Update trafficAllocation array with new weight
        const updatedAllocation = (experiment.trafficAllocation as any[]).map((item: any) => {
          if (item.id === id) {
            return {
              ...item,
              weight: updateData.weight,
            }
          }
          return item
        })

        // Update experiment with new trafficAllocation
        await updateExperiment(currentVariant.experimentId, {
          trafficAllocation: updatedAllocation
        })
      }
    }

    return NextResponse.json({ variant })
  } catch (error) {
    console.error('Error updating variant:', error)
    return NextResponse.json(
      { error: 'Failed to update variant' },
      { status: 500 }
    )
  }
}
