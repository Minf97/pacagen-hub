import { NextResponse } from 'next/server';
import { getExperimentById, updateExperiment, deleteExperiment, getVariantsByExperimentId } from '@/lib/db/queries';
import { updateExperimentSchema } from '@/lib/validations/experiment';
import type { ExperimentInsert } from '@/lib/db/schema';

// GET /api/experiments/[id] - Get experiment by ID
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const experiment = await getExperimentById(id);

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    return NextResponse.json({ experiment });
  } catch (error) {
    console.error('Error fetching experiment:', error);
    return NextResponse.json({ error: 'Failed to fetch experiment' }, { status: 500 });
  }
}

// PATCH /api/experiments/[id] - Update experiment
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const validation = updateExperimentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Partial<ExperimentInsert> = {};

    if (validation.data.name) updateData.name = validation.data.name;
    if (validation.data.description !== undefined) updateData.description = validation.data.description;
    if (validation.data.hypothesis !== undefined) updateData.hypothesis = validation.data.hypothesis;
    if (validation.data.status) updateData.status = validation.data.status;
    if (validation.data.trafficAllocation) updateData.trafficAllocation = validation.data.trafficAllocation;
    if (validation.data.targetingRules) updateData.targetingRules = validation.data.targetingRules;

    // Handle status changes
    if (validation.data.status === 'running') {
      // Validate that total weight is 100% before starting experiment
      const variants = await getVariantsByExperimentId(id);
      const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);

      if (totalWeight !== 100) {
        return NextResponse.json({
          error: `Cannot start experiment: total traffic allocation must be 100%. Current total is ${totalWeight}%.`,
          totalWeight,
          variants: variants.map(v => ({ id: v.id, name: v.displayName, weight: v.weight }))
        }, { status: 400 });
      }

      updateData.startedAt = new Date();
      updateData.endedAt = null;
    }
    if (validation.data.status === 'completed') {
      updateData.endedAt = new Date();
    }

    const experiment = await updateExperiment(id, updateData);

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Fetch with variants
    const updatedExperiment = await getExperimentById(id);

    return NextResponse.json({ experiment: updatedExperiment });
  } catch (error) {
    console.error('Error updating experiment:', error);
    return NextResponse.json({ error: 'Failed to update experiment' }, { status: 500 });
  }
}

// DELETE /api/experiments/[id] - Delete experiment
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Check if experiment exists
    const experiment = await getExperimentById(id);

    if (!experiment) {
      return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
    }

    // Prevent deletion of running experiments
    if (experiment.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete a running experiment. Please pause it first.' },
        { status: 400 }
      );
    }

    await deleteExperiment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting experiment:', error);
    return NextResponse.json({ error: 'Failed to delete experiment' }, { status: 500 });
  }
}
