# 🔧 Troubleshooting Guide

## Common Issues

### 1. RLS Policy Error

#### Problem
Error when creating experiments:
```
new row violates row-level security policy for table "experiments"
```

#### Root Cause
The initial RLS policies require user authentication, but we haven't implemented auth yet.

#### ✅ Solution (Choose One)

**Option 1: Update RLS Policies (Recommended)**

**Step 1**: Go to your Supabase project dashboard

**Step 2**: Navigate to **SQL Editor**

**Step 3**: Copy and paste the contents of:
```
supabase/migrations/002_fix_rls_policies.sql
```

**Step 4**: Click **Run**

This will update the policies to allow development without authentication.

**Option 2: Temporarily Disable RLS (Quick Test)**

If you just want to test quickly, run this in SQL Editor:

```sql
ALTER TABLE experiments DISABLE ROW LEVEL SECURITY;
ALTER TABLE variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_stats DISABLE ROW LEVEL SECURITY;
```

⚠️ **Warning**: This completely disables security. Only use for local development!

#### Verification

After applying the fix:

1. Restart your dev server: `npm run dev`
2. Try creating a new experiment at `/experiments/new`
3. Should work without errors! ✅

## What Changed?

**Before**: Policies required `auth.uid()` (authenticated user)
```sql
CREATE POLICY "Allow experiment creators to update"
  ON experiments FOR UPDATE
  USING (created_by = auth.uid())  -- ❌ Requires auth
```

**After**: Policies allow anonymous access
```sql
CREATE POLICY "Allow all users to update experiments"
  ON experiments FOR UPDATE
  TO anon, authenticated
  USING (true)  -- ✅ No auth required
```

## Production Considerations

⚠️ **Important**: These permissive policies are for development only!

Before deploying to production, you should:

1. Implement Supabase Auth
2. Replace policies with user-scoped access
3. Add role-based permissions

Example production policy:
```sql
CREATE POLICY "Users manage own experiments"
  ON experiments FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
```

---

### 2. Database Relationship Error

#### Problem
Error when fetching experiments:
```
Could not embed because more than one relationship was found for 'experiments' and 'variants'
code: 'PGRST201'
```

#### Root Cause
Supabase detected multiple possible relationship paths between tables and doesn't know which one to use.

#### ✅ Solution
**Already Fixed!** The code now uses explicit foreign key references.

If you still see this error:

1. **Pull latest code**: Make sure you have the latest version
2. **Check your query syntax**: Should use `variants!variants_experiment_id_fkey`
3. **Restart dev server**: `npm run dev`

#### Technical Details
See [DATABASE_FIX.md](DATABASE_FIX.md) for complete explanation.

---

### 3. General Tips

## Need Help?

Check these resources:
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- Project README: `/README.md`

---

**Status**: Development mode policies configured ✅
**Next Step**: Implement authentication for production
