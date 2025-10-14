# Database Relationship Fix

## Problem
Error when querying experiments with variants:
```
Could not embed because more than one relationship was found for 'experiments' and 'variants'
```

## Root Cause
Supabase detected multiple possible relationship paths between `experiments` and `variants`:

1. **Direct relationship**: `variants.experiment_id → experiments.id`
2. **Through stats**: `experiment_stats` creates another relationship path

## Solution
Explicitly specify which foreign key relationship to use:

### Before (Ambiguous)
```typescript
.select(`
  *,
  variants (*)
`)
```

### After (Explicit)
```typescript
.select(`
  *,
  variants!variants_experiment_id_fkey (*)
`)
```

## Foreign Key Reference
The `!variants_experiment_id_fkey` tells Supabase to use this specific foreign key:

```sql
-- From variants table
FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE
```

## Files Updated
- ✅ `app/api/experiments/route.ts` - List experiments
- ✅ `app/api/experiments/[id]/route.ts` - Get/Update single experiment
- ✅ `app/(dashboard)/experiments/page.tsx` - Experiments page

## Verification
After the fix, these queries should work:

```typescript
// Get all experiments with variants
const { data } = await supabase
  .from('experiments')
  .select(`
    *,
    variants!variants_experiment_id_fkey (*)
  `)

// Get experiment with variant count
const { data } = await supabase
  .from('experiments')
  .select(`
    *,
    variants:variants!variants_experiment_id_fkey (count)
  `)
```

## Other Relationships
For reference, here are all the foreign keys:

### variants table
- `experiment_id` → `experiments.id` (the one we use)

### user_assignments table
- `experiment_id` → `experiments.id`
- `variant_id` → `variants.id`

### events table
- `experiment_id` → `experiments.id`
- `variant_id` → `variants.id`

### experiment_stats table
- `experiment_id` → `experiments.id`
- `variant_id` → `variants.id`

## Status
✅ Fixed - All queries now use explicit foreign key references
