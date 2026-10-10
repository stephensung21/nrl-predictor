# rugbyleague-tipper (website)

The Next.js site from [PLAN_WEB.md](../PLAN_WEB.md) §3, designed to [DESIGN_BRIEF.md](../DESIGN_BRIEF.md).

```
npm install
npm run dev        # http://localhost:3000
```

Only the home page exists so far. It runs on sample data (`lib/sample.ts`): the real 2026 Round 10 replay predictions and results, with made-up tippers. A sample bar at the bottom of the page switches between the states of the NRL week (recap, tipping open, in progress), signed in or out, and the empty and error states. Row shapes in `lib/types.ts` follow the planned Supabase tables, so the sample can be swapped for real queries.
