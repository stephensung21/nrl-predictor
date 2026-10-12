# rugbyleague-tipper (website)

The Next.js site from [PLAN_WEB.md](../docs/PLAN_WEB.md) §3, designed to [DESIGN_BRIEF.md](../docs/DESIGN_BRIEF.md) and [DESIGN.md](../DESIGN.md).

```
npm install
npm run dev        # http://localhost:3000
npm test           # vitest, including the tipping rules in Postgres (PGlite)
```

Pages: the round's predictions (home), a match page, past rounds, model vs market (`/odds`), Elo, the model's record, news, and the tipping comp (tips, ladder, admin, invites).

With no environment variables set, every page runs on sample data (`lib/sample*.ts`): the real 2026 Round 10 replay predictions and results, with made-up tippers. A sample bar at the bottom of the page switches between the states of the NRL week (recap, tipping open, in progress), signed in or out, and the empty and error states. Copy [`.env.example`](.env.example) to `.env.local` to read the model data and tipping comp from Supabase instead.

## Deployment

Live at https://nrl-predictor.vercel.app. Vercel builds `main` on every push (project root `web`), and the server code runs in Sydney (`vercel.json`) next to the Supabase project. The environment variables are the four in `.env.example`, set in Vercel's project settings. Every data page renders per request, so the build never reads the database and a page always shows the latest published data. Details and history: [PLAN_WEB.md](../docs/PLAN_WEB.md) step 12.
