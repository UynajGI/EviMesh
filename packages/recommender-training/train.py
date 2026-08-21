# Offline recommender trainer (owner direction 2026-08-21)
#
# Reads personal engagement signals, trains an item-item collaborative
# filtering model with the open-source `implicit` library, and writes a
# per-actor top-N into recommendation_cache. Production stays free of Python:
# this job runs on a schedule from GitHub Actions with a direct Postgres
# connection (table owner bypasses RLS); api-edge only reads the cache.
#
# Local run:
#   py -m pip install -r requirements.txt
#   set EVIMESH_DATABASE_URL=postgresql://... && py train.py

import os
import sys
import uuid
from datetime import datetime, timezone

import numpy as np
import psycopg
from scipy.sparse import coo_matrix

from implicit.nearest_neighbours import ItemItemRecommender

KIND_WEIGHTS = {"helpful": 5.0, "favorite": 4.0, "watch": 2.5, "view": 1.0}
MODEL_ID = "implicit-itemitem"
NEIGHBORS_K = 20
TOP_N = int(os.environ.get("EVIMESH_REC_TOP_N", "12"))
MIN_SIGNALS = int(os.environ.get("EVIMESH_REC_MIN_SIGNALS", "8"))
MIN_USERS = 2
MAX_INTERACTIONS = 100_000
REASON_TITLE_MAX = 80


def load_interactions(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT actor_id, object_type || ':' || object_id, kind
            FROM engagement_interactions
            ORDER BY created_at ASC
            LIMIT %s
            """,
            (MAX_INTERACTIONS,),
        )
        return cur.fetchall()


def load_item_titles(conn, item_keys):
    """Map "type:id" keys to a short human title for reason lines."""
    wanted = set(item_keys)
    titles = {}
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 'question:' || q.question_id, r.title
            FROM questions q
            JOIN LATERAL (
                SELECT title FROM question_revisions qr
                WHERE qr.question_id = q.question_id
                ORDER BY revision DESC LIMIT 1
            ) r ON true
            """
        )
        for key, title in cur.fetchall():
            if key in wanted:
                titles[key] = (title or "").strip()
        cur.execute(
            """
            SELECT 'claim:' || c.claim_id, r.statement
            FROM claims c
            JOIN LATERAL (
                SELECT statement FROM claim_revisions cr
                WHERE cr.claim_id = c.claim_id
                ORDER BY revision DESC LIMIT 1
            ) r ON true
            """
        )
        for key, statement in cur.fetchall():
            if key in wanted:
                titles[key] = (statement or "").strip()
    return {key: value[:REASON_TITLE_MAX] for key, value in titles.items() if value}


def build_matrix(rows):
    users = sorted({row[0] for row in rows})
    items = sorted({row[1] for row in rows})
    user_index = {user: position for position, user in enumerate(users)}
    item_index = {item: position for position, item in enumerate(items)}
    weights = {}
    for actor, item, kind in rows:
        weight = KIND_WEIGHTS.get(kind, 1.0)
        key = (user_index[actor], item_index[item])
        weights[key] = max(weights.get(key, 0.0), weight)
    matrix = coo_matrix(
        (
            # ItemItemRecommender's knn kernel expects float64 buffers.
            np.asarray(list(weights.values()), dtype=np.float64),
            (
                np.asarray([key[0] for key in weights], dtype=np.int32),
                np.asarray([key[1] for key in weights], dtype=np.int32),
            ),
        ),
        shape=(len(users), len(items)),
    ).tocsr()
    return matrix, users, items, item_index


def reason_for(similarity, user_items, candidate, titles, items):
    """Strongest already-interacted neighbor of the candidate item."""
    # KNN truncates per row, so the candidate's own row is always populated
    # while its column may be empty (the matrix is asymmetric).
    row = similarity[candidate]
    best, best_score = None, 0.0
    for position in range(len(row.indices)):
        item = int(row.indices[position])
        score = float(row.data[position])
        if item in user_items and score > best_score:
            best, best_score = item, score
    if best is None:
        return None
    title = titles.get(items[best])
    return f"near your item: {title}" if title else "near your marked items"


def main():
    dsn = os.environ.get("EVIMESH_DATABASE_URL")
    if not dsn:
        print("EVIMESH_DATABASE_URL is required", file=sys.stderr)
        return 2
    generated_at = datetime.now(timezone.utc)

    with psycopg.connect(dsn) as conn:
        rows = load_interactions(conn)
        if len(rows) < MIN_SIGNALS or len({row[0] for row in rows}) < MIN_USERS:
            # Too little signal to filter collaboratively: clear the cache
            # instead of surfacing noise, and exit clean for the scheduler.
            with conn.cursor() as cur:
                cur.execute("DELETE FROM recommendation_cache")
            conn.commit()
            print(f"cleared recommendation_cache ({len(rows)} signals, below threshold)")
            return 0

        matrix, users, items, item_index = build_matrix(rows)
        user_items = [set(matrix.getrow(position).indices) for position in range(len(users))]
        titles = load_item_titles(conn, items)

        model = ItemItemRecommender(K=NEIGHBORS_K)
        model.fit(matrix, show_progress=False)

        pending = []
        for position, actor in enumerate(users):
            # Per-user row slice: this implicit version only honors
            # filter_already_liked_items when user_items matches the userid row.
            ids, scores = model.recommend(position, matrix[position], N=TOP_N, filter_already_liked_items=True)
            rank = 0
            for item, score in zip(ids, scores):
                # implicit pads short lists with zero-score items; keep only
                # real collaborative evidence, never the user's own items.
                if float(score) <= 0.0 or item in user_items[position]:
                    break
                rank += 1
                key = items[item]
                object_type, _, object_id = key.partition(":")
                reason = reason_for(model.similarity, user_items[position], item, titles, items)
                pending.append(
                    (
                        str(uuid.uuid4()),
                        actor,
                        object_type,
                        object_id,
                        rank,
                        reason,
                        generated_at,
                        MODEL_ID,
                    )
                )

        with conn.cursor() as cur:
            cur.execute("DELETE FROM recommendation_cache")
            # Whole-batch replace keeps the transaction atomic per run.
            cur.executemany(
                """
                INSERT INTO recommendation_cache
                    (id, actor_id, object_type, object_id, rank, reason, generated_at, model)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                pending,
            )
        conn.commit()
        print(f"wrote {len(pending)} recommendations for {len(users)} actors (model {MODEL_ID})")
        return 0


if __name__ == "__main__":
    sys.exit(main())
