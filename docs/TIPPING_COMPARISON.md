# Tipping comp: how it compares with other comps

How the site's tipping comp (`web/lib/rules.ts`, `web/lib/scoring.ts`, `supabase/migrations/20261010000000_tipping.sql`) compares with the official NRL Tipping game and with tipping and pick'em games in other sports. Researched 13 October 2026.

**Summary:** the comp follows the official NRL Tipping "classic" rules closely, and those rules are the norm for Australian footy tipping. There are two unplanned differences (the default margin and late joiners) and one missing option (the Favourites auto-tip).

The official rules page (tipping.nrl.com/help) is built with JavaScript; its text comes from `https://tipping.nrl.com/help_center/en-us/articles.json` (the "Game Guidelines 26" and FAQ articles, updated 6 October 2026).

## Against the official 2026 NRL Tipping rules

| Rule | Official 2026 | This comp | Same? |
|---|---|---|---|
| Points | 1 per correct tip, 0 for a wrong one | Same | ✅ |
| Lockout | Each game locks at its kickoff; tips can be changed until then | Same, enforced by the database's row-level security | ✅ |
| Draws and cancelled games | Win for both teams, including games with no result within 3 days | Same | ✅ |
| Perfect-round bonus | 1 point, rounds of 8+ games, none if any tip was an auto-tip | Same | ✅ |
| Auto-tip choice | Set when you sign up, can be changed until the season's first game locks | Same (`lock_auto_tip` trigger) | ✅ |
| Auto-tip options | Home, Crowd, Ladder, **Favourites** (the bookmaker's favourite at lockout). The FAQ also lists Away and Random | Home, Crowd, Ladder | ⚠️ Favourites is missing |
| Auto-tip ties | Crowd and Favourites fall back to the home team | Same | ✅ |
| Margin game | One game a round, picked at random | Random, but excludes the previous round's two teams (this comp's own rule) | ✅ plus an extra rule |
| Margin score | Gap between predicted and actual margin, added up over the season | Same; a wrong-team tip also counts as a negative margin (the official rules don't say) | ✅ |
| **Default margin** | **Average of all margins entered that round** | Fixed 12 | ❌ |
| Ladder ties | Lowest total margin score, then whoever registered first | Lowest total margin score, then a shared place | ✅ close enough for a friends' comp |
| **Late joiners** | Past rounds are scored as away-team tips, **capped at 4 points a round** | Same since October 2026 (games before you joined); before that, auto-tips with no cap | ✅ fixed |
| Matches covered | All NRL games, the finals and the men's State of Origin | NRL games and finals only | Minor difference |
| Experts in comps | Comp admins can add "expert" tippers to their comp | The Model tips as an unranked yardstick | ✅ same idea |

### Things to fix

1. **Default margin.** `PLAN_WEB.md` §3.5 says the official rules don't give the default margin, but the 2026 rules do: it's the average of the margins entered that round. In SQL this is an `avg(margin)` over the round's tips in the `featured` part of `round_scores`. Decide whether the Model's margin counts towards the average.
2. ✅ **Late joiners** (done, October 2026: the official rule, in `20261020000000_late_joiners.sql` and `web/lib/scoring.ts`). `effective_tips` cross-joins every profile with every game that has locked, and doesn't check when the tipper joined. Someone who joins in Round 10 with the "crowd" auto-tip gets the group's consensus on every earlier game, which could put them ahead of people who tipped all season. The official rule is away-team tips, capped at 4 points a round. The simplest fix is to filter on `profiles.created_at < kickoff`, or copy the official cap. It may never come up in a small invite-only comp, but it should be a deliberate choice.
3. **The "Favourites" auto-tip.** The pipeline already ingests bookmaker odds, so this is cheap to add, and it's the strongest of the official options. "The Model's tip" would make a natural extra option.

## What other comps do that this comp doesn't

| Feature | Who uses it | Worth adding? |
|---|---|---|
| **Streak game**: pick winners in a row and skip any game you like; your longest streak ranks you | Official NRL (separate prize) | "Longest streak" is already planned as a stat. A separate streak game is more than a few friends need |
| **Auto Pick button**: fills a whole round in one tap using a chosen strategy | Official NRL | ✅ Added October 2026: the Model, home teams or ladder, for the games you haven't tipped |
| **Round winner and monthly winners** | Official NRL (round and monthly rankings) | Round winners are already planned |
| **Club leagues**: everyone is ranked against fans of their own team | Official NRL | The favourite team is already stored |
| **Joker round**: doubles your score once a season | iTipFooty | Optional extra |
| **Odds-based scoring**: an upset tip is worth more | iTipFooty, Superbru's options | Changes how the comp plays. It doesn't match the official rules |
| **Knockout / last man standing** | iTipFooty | Separate game |
| **Margin points**: points for a margin within 5; a pool bonus for the closest margin | Superbru | Different scoring system |
| **Exact score**: 5 points for the result, 10 for the exact score | Premier League Predictor | Suits soccer, not league |
| **Confidence points**: rank each week's picks from 1 to N; a correct pick earns its rank | NFL pick'em (Yahoo) | Interesting, but not how NRL tipping works |

The comp's main differences from these games are the Model as a tipper with a probability hint (the official game shows bookmaker odds and match facts instead) and the margin-game exclusion rule. Both are deliberate extras, not departures from the rules.

## Recommendation

Fix the default margin and decide how late joiners are scored before the 2027 season, since those are the two places where the comp differs from the official rules without having chosen to. Then add the Favourites auto-tip, since the odds are already ingested. The other features belong to other kinds of comp and aren't needed here.

## Sources

- [2026 NRL Tipping official rules](https://tipping.nrl.com/help) (text from the help-centre JSON behind it)
- [NRLW Tipping FAQs](https://nrlwtipping.nrl.com/help/competition-faqs)
- [iTipFooty NRL](https://www.itipfooty.com.au/tipping/nrl/)
- [Superbru NRL scoring](https://old.superbru.com/nrltipping/how_to_play_scoring.php)
- [Premier League Matchweek Predictor](https://www.premierleague.com/en/games/premier-league-matchweek-predictor/matchweek-8)
- [Yahoo confidence points](https://help.yahoo.com/kb/SLN6640.html)
- [Splash Sports: NFL confidence pools explained](https://splashsports.com/blog/nfl-confidence-pools-explained-how-to-maximize-your-points)
- [AWS Australia footy tipping terms](https://footytipping.awsaustralia.com.au/view/Affiliate/site/orgsite/awsa70/images/TERMS091818.pdf)
- [Clear Grain footy tipping](https://www.blog.cleargrain.com.au/cgxfootytipping)
- [Zero Tackle: tipping the finals](https://www.zerotackle.com/tipping-finals/)
