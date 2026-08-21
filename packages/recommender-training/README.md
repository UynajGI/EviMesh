# Recommender training

Offline item-item collaborative filtering for the personal "For you" rail.

- **Engine**: [`implicit`](https://github.com/benfred/implicit) `ItemItemRecommender` (open-source CF library; the algorithm is not hand-rolled).
- **Signals**: `engagement_interactions` rows (`helpful` 5.0 / `favorite` 4.0 / `watch` 2.5 / `view` 1.0).
- **Output**: `recommendation_cache` — per-actor top-N navigation refs with a one-line reason. The whole table is replaced atomically per run.
- **Runtime split**: production never runs Python. GitHub Actions trains on a schedule with a direct Postgres connection (table owner bypasses RLS); `api-edge` only reads the cache for the requesting actor (`GET /recommendations`).

Constitutional boundaries (AGENTS.md): signals are private — no public counts, scores, or rankings anywhere; recommendations are a separately labeled navigation surface and never reorder the chronological feed.

## Run locally

```powershell
py -m venv .venv
.venv\Scripts\pip install -r requirements.txt
$env:EVIMESH_DATABASE_URL = "postgresql://postgres.<ref>:<password>@<pooler>.supabase.com:5432/postgres"
.venv\Scripts\python train.py
```

Environment knobs: `EVIMESH_REC_TOP_N` (default 12), `EVIMESH_REC_MIN_SIGNALS` (default 8; below this plus fewer than 2 actors the run clears the cache and exits clean).

## CI

`.github/workflows/recommender-training.yml` runs hourly (`23 * * * *`) plus manual dispatch, reading `EVIMESH_PRODUCTION_DATABASE_URL` from repository secrets.
