import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()

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

    // Get current variant to check experiment_id
    const { data: currentVariant, error: fetchError } = await supabase
      .from('variants')
      .select('experiment_id, weight')
      .eq('id', id)
      .single()

    if (fetchError || !currentVariant) {
      return NextResponse.json(
        { error: 'Variant not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (body.weight !== undefined) updateData.weight = Number(body.weight)
    if (body.display_name !== undefined) updateData.display_name = body.display_name
    if (body.config !== undefined) updateData.config = body.config

    // Update variant
    const { data: variant, error: updateError } = await supabase
      .from('variants')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // If weight was updated, validate total weight for experiment
    if (body.weight !== undefined) {
      const { data: allVariants, error: variantsError } = await supabase
        .from('variants')
        .select('weight')
        .eq('experiment_id', currentVariant.experiment_id)

      if (!variantsError && allVariants) {
        const totalWeight = allVariants.reduce((sum, v) => sum + v.weight, 0)

        // Return warning if total weight is not 100
        if (totalWeight !== 100) {
          return NextResponse.json({
            variant,
            warning: `Total weight is ${totalWeight}%. Please adjust to 100%.`,
            totalWeight
          })
        }
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
