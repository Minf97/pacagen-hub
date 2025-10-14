# PacagenHub - Self-Hosted A/B Testing Framework

A powerful, self-hosted A/B testing framework designed for Hydrogen storefronts. Built to eliminate client-side flicker through server-side variant assignment.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- A Supabase account (free tier works great!)
- npm or yarn

### 1. Clone and Install

```bash
git clone <your-repo>
cd pacagen-hub
npm install
```

### 2. Setup Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Navigate to **SQL Editor** in your Supabase dashboard
3. Copy the contents of `supabase/migrations/001_initial_schema.sql`
4. Paste and run the SQL in the editor
5. **IMPORTANT**: Run the RLS fix migration: `supabase/migrations/002_fix_rls_policies.sql`
   - This allows development without authentication
   - See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for details

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Where to find these:**
- Go to your Supabase project
- Click **Settings** → **API**
- Copy the values:
  - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep secret!)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) - you should see the experiments dashboard!

## 📂 Project Structure

```
pacagen-hub/
├── app/
│   ├── (dashboard)/
│   │   ├── experiments/          # Experiment management
│   │   ├── analytics/             # Analytics dashboard
│   │   └── settings/              # System settings
│   ├── api/                       # API routes (next step)
│   └── layout.tsx                 # Root layout
├── components/
│   └── ui/                        # shadcn/ui components
├── lib/
│   ├── supabase/                  # Supabase clients
│   │   ├── client.ts              # Browser client
│   │   ├── server.ts              # Server client
│   │   └── types.ts               # Database types
│   └── utils.ts                   # Utilities
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql # Database schema
```

## 🗄️ Database Schema

The framework uses 5 core tables:

- **experiments** - Experiment definitions
- **variants** - Variant configurations
- **user_assignments** - User→variant mappings
- **events** - Tracking events (exposure, clicks, conversions)
- **experiment_stats** - Aggregated analytics

## 🎯 Current Progress

✅ **Phase 1: Foundation** (Complete)
- Database schema created
- Supabase integration configured
- Next.js 15 dashboard initialized
- Base layout and navigation

🚧 **Phase 2: Experiment Management** (In Progress)
- Experiments list page ✅
- Create experiment form (next)
- Variant builder (next)
- Edit/delete functionality (next)

📋 **Phase 3: Analytics** (Planned)
- Real-time statistics
- Conversion charts
- Statistical significance

🔧 **Phase 4: API Layer** (Planned)
- CRUD endpoints
- Event tracking API
- Webhook support

⚡ **Phase 5: Edge Integration** (Planned)
- Cloudflare Workers
- Zero-flicker assignment

## 🔗 Integration with Hydrogen

This admin dashboard manages experiments that will be consumed by your Hydrogen storefront.

The Hydrogen integration code already exists and is validated at:
`/Users/xuyuquan/Desktop/code/headless/app/lib/abtest/`

Demo: http://localhost:3000/abtest-demo (when headless project is running)

## 📝 Next Steps

1. ✅ Setup database
2. ✅ Configure environment
3. ✅ View experiments list
4. ⏳ Create your first experiment
5. ⏳ Add variants
6. ⏳ Start experiment
7. ⏳ View analytics

## 🆘 Troubleshooting

**Issue: "new row violates row-level security policy"**
- **Solution**: Run the RLS fix migration `002_fix_rls_policies.sql`
- **Details**: See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for complete guide

**Issue: "Failed to fetch experiments"**
- Check your `.env.local` file has correct Supabase credentials
- Verify both SQL migrations ran successfully in Supabase
- Check browser console for specific error messages

**Issue: TypeScript errors**
- Run `npm install` to ensure all dependencies are installed
- Restart your IDE to refresh TypeScript server

For more help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## 🤝 Contributing

This is currently a private project. If you have access, feel free to:
- Create issues for bugs
- Suggest features
- Submit pull requests

## 📄 License

Private - All Rights Reserved

## 🔗 Resources

- [Linear Issue TES-90](https://linear.app/testing-minf/issue/TES-90) - Complete specification
- [Hydrogen Docs](https://hydrogen.shopify.dev/) - Shopify Hydrogen framework
- [Supabase Docs](https://supabase.com/docs) - Database & authentication
- [Next.js 15 Docs](https://nextjs.org/docs) - Framework documentation

---

**Built with ❤️ for zero-flicker A/B testing**
