import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ExperimentInsert, VariantInsert } from '@/lib/supabase/types'

// GET /api/experiments - List all experiments
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: experiments, error } = await supabase
      .from('experiments')
      .select(`
        *,
        variants!variants_experiment_id_fkey (*)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ experiments })
  } catch (error) {
    console.error('Error fetching experiments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch experiments' },
      { status: 500 }
    )
  }
}

// POST /api/experiments - Create new experiment
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, hypothesis, variants } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Experiment name is required' },
        { status: 400 }
      )
    }

    if (!variants || variants.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 variants are required' },
        { status: 400 }
      )
    }

    // Validate weight total
    const totalWeight = variants.reduce((sum: number, v: any) => sum + v.weight, 0)
    if (totalWeight !== 100) {
      return NextResponse.json(
        { error: 'Total variant weight must equal 100%' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Create experiment
    const experimentData: ExperimentInsert = {
      name,
      description: description || null,
      hypothesis: hypothesis || null,
      status: 'draft',
      traffic_allocation: variants.reduce((acc: any, v: any) => {
        acc[v.name] = v.weight
        return acc
      }, {}),
      targeting_rules: {},
      // created_by will be set by auth when implemented
    }

    const { data: experiment, error: experimentError } = await supabase
      .from('experiments')
      .insert(experimentData)
      .select()
      .single()

    if (experimentError) throw experimentError

    // Create variants
    const variantData: VariantInsert[] = variants.map((v: any) => ({
      experiment_id: experiment.id,
      name: v.name,
      display_name: v.display_name,
      is_control: v.is_control || false,
      weight: v.weight,
      config: {},
    }))

    const { data: createdVariants, error: variantsError } = await supabase
      .from('variants')
      .insert(variantData)
      .select()

    if (variantsError) throw variantsError

    return NextResponse.json({
      experiment: {
        ...experiment,
        variants: createdVariants,
      },
    })
  } catch (error) {
    console.error('Error creating experiment:', error)
    return NextResponse.json(
      { error: 'Failed to create experiment' },
      { status: 500 }
    )
  }
}
