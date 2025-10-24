import { NextResponse } from 'next/server';
import { getAllExperiments, createExperimentWithVariants } from '@/lib/db/queries';
import { createExperimentSchema } from '@/lib/validations/experiment';
import type { ExperimentInsert, VariantInsert } from '@/lib/db/schema';

// GET /api/experiments - List all experiments
export async function GET() {
  try {
    const experiments = await getAllExperiments();
    return NextResponse.json({ experiments });
  } catch (error) {
    console.error('Error fetching experiments:', error);
    return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
  }
}

// POST /api/experiments - Create new experiment
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = createExperimentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { name, description, hypothesis, variants: variantsInput } = validation.data;

    // Prepare experiment data
    const experimentData: ExperimentInsert = {
      name,
      description: description || null,
      hypothesis: hypothesis || null,
      status: 'draft',
      trafficAllocation: [], // Will be populated after variants are created
      targetingRules: {},
    };

    // Prepare variants data (without experimentId)
    const variantsData: Omit<VariantInsert, 'experimentId'>[] = variantsInput.map((v) => ({
      name: v.name,
      displayName: v.displayName,
      isControl: v.isControl,
      weight: v.weight,
      config: v.config || {},
    }));

    // Create experiment and variants in a single transaction
    const { experiment, variants } = await createExperimentWithVariants(
      experimentData,
      variantsData
    );

    return NextResponse.json({
      experiment: {
        ...experiment,
        variants,
      },
    });
  } catch (error) {
    console.error('Error creating experiment:', error);
    return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
  }
}
