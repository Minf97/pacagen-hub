import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ExperimentUpdate } from '@/lib/supabase/types'

// GET /api/experiments/[id] - Get experiment by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: experiment, error } = await supabase
      .from('experiments')
      .select(`
        *,
        variants!variants_experiment_id_fkey (*)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    if (!experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error('Error fetching experiment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiment' },
      { status: 500 }
    )
  }
}

// PATCH /api/experiments/[id] - Update experiment
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    // Build update object
    const updateData: ExperimentUpdate = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.hypothesis !== undefined) updateData.hypothesis = body.hypothesis
    if (body.status !== undefined) updateData.status = body.status
    if (body.traffic_allocation !== undefined) updateData.traffic_allocation = body.traffic_allocation
    if (body.targeting_rules !== undefined) updateData.targeting_rules = body.targeting_rules

    // Handle status changes
    if (body.status === 'running' && !body.started_at) {
      updateData.started_at = new Date().toISOString()
    }
    if (body.status === 'completed' && !body.ended_at) {
      updateData.ended_at = new Date().toISOString()
    }

    const { data: experiment, error } = await supabase
      .from('experiments')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        variants!variants_experiment_id_fkey (*)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ experiment })
  } catch (error) {
    console.error('Error updating experiment:', error)
    return NextResponse.json(
      { error: 'Failed to update experiment' },
      { status: 500 }
    )
  }
}

// DELETE /api/experiments/[id] - Delete experiment
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if experiment exists
    const { data: experiment, error: fetchError } = await supabase
      .from('experiments')
      .select('id, status')
      .eq('id', id)
      .single()

    if (fetchError || !experiment) {
      return NextResponse.json(
        { error: 'Experiment not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of running experiments
    if (experiment.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete a running experiment. Please pause it first.' },
        { status: 400 }
      )
    }

    // Delete experiment (variants will cascade delete)
    const { error: deleteError } = await supabase
      .from('experiments')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting experiment:', error)
    return NextResponse.json(
      { error: 'Failed to delete experiment' },
      { status: 500 }
    )
  }
}
