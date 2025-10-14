# ✅ Setup Checklist

Use this checklist to ensure everything is configured correctly.

## Prerequisites

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm or yarn installed
- [ ] Supabase account created

## Database Setup

- [ ] Created Supabase project at https://supabase.com
- [ ] Ran `001_initial_schema.sql` in SQL Editor
- [ ] Ran `002_fix_rls_policies.sql` in SQL Editor ⚠️ **CRITICAL**
- [ ] Verified tables exist:
  - [ ] experiments
  - [ ] variants
  - [ ] user_assignments
  - [ ] events
  - [ ] experiment_stats

## Environment Configuration

- [ ] Copied `.env.local.example` to `.env.local`
- [ ] Added `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Added `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Verified URLs have no trailing slashes

## Application Setup

- [ ] Ran `npm install` successfully
- [ ] No installation errors
- [ ] Started dev server with `npm run dev`
- [ ] Application accessible at http://localhost:3000

## Functionality Tests

### Test 1: View Experiments List
- [ ] Navigate to http://localhost:3000
- [ ] See "No experiments yet" message (if first time)
- [ ] No console errors

### Test 2: Create Experiment
- [ ] Click "New Experiment" button
- [ ] Fill in experiment name: "Test Experiment"
- [ ] See 2 default variants (Control, Variant A)
- [ ] Both variants at 50% weight
- [ ] Total shows 100%
- [ ] Click "Create Experiment"
- [ ] ✅ Success: Redirects to experiment detail page
- [ ] ❌ Error: See troubleshooting below

### Test 3: View Experiment Detail
- [ ] See experiment name and details
- [ ] Status badge shows "Draft"
- [ ] 2 variants listed with weights
- [ ] "Start Experiment" button visible

### Test 4: Start Experiment
- [ ] Click "Start Experiment" button
- [ ] Status changes to "Running"
- [ ] "Pause" button now visible
- [ ] Started timestamp appears

### Test 5: Pause & Complete
- [ ] Click "Pause" button
- [ ] Status changes to "Paused"
- [ ] "Resume" and "Complete" buttons visible
- [ ] Click "Complete"
- [ ] Status changes to "Completed"

## Common Issues

### ❌ "new row violates row-level security policy"

**Cause**: RLS policies not updated

**Fix**:
1. Go to Supabase SQL Editor
2. Run `002_fix_rls_policies.sql`
3. Restart dev server
4. Try again

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for details.

### ❌ "Failed to fetch experiments"

**Possible Causes**:
1. Wrong environment variables
2. Supabase project not accessible
3. Network issues

**Fix**:
1. Check `.env.local` credentials
2. Verify Supabase project is active
3. Check browser console for exact error

### ❌ "Cannot find module"

**Fix**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### ❌ TypeScript errors in IDE

**Fix**:
1. Restart your IDE
2. Run `npm run dev` to regenerate types
3. Check `tsconfig.json` paths are correct

## Verification

If all tests pass:

✅ **You're ready to use PacagenHub!**

Create real experiments and integrate with your Hydrogen storefront.

If any test fails:

❌ **Check the troubleshooting section**

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) or [README.md](README.md)

## Next Steps

After successful setup:

1. Read [DEVELOPMENT.md](DEVELOPMENT.md) for architecture details
2. Create your first production experiment
3. Integrate with Hydrogen storefront
4. Review TES-90 specification in Linear

---

**Need Help?**
- Documentation: [README.md](README.md)
- Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- Architecture: [DEVELOPMENT.md](DEVELOPMENT.md)
