"""Self-test for train.py — pure logic, no database required.

Run:  py selftest.py   (exit 0 = green)
Covers the pieces that broke during bring-up: float64 matrix dtype,
per-user row slicing, duplicate-kind weight aggregation, zero-score padding
truncation, self-item exclusion, and the asymmetric-similarity reason lookup.
"""

import sys

import numpy as np
from implicit.nearest_neighbours import ItemItemRecommender

import train


def check(name, condition):
    if not condition:
        print(f"FAIL: {name}")
        sys.exit(1)
    print(f"ok: {name}")


ROWS = [
    ("a", "question:q1", "helpful"),
    ("a", "question:q2", "favorite"),
    ("a", "question:q3", "view"),
    ("a", "question:q2", "view"),  # duplicate kind pair must aggregate to max
    ("b", "question:q1", "helpful"),
    ("b", "question:q2", "helpful"),
    ("b", "question:q3", "favorite"),
    ("b", "claim:c9", "helpful"),
    ("c", "claim:c9", "favorite"),
    ("c", "claim:c8", "helpful"),
    ("c", "question:q2", "view"),
]

TITLES = {
    "question:q1": "Q1",
    "question:q2": "Q2",
    "question:q3": "Q3",
    "claim:c9": "C9",
    "claim:c8": "C8",
}


def main():
    matrix, users, items, item_index = train.build_matrix(ROWS)
    check("matrix dtype is float64 (knn kernel requirement)", matrix.dtype == np.float64)
    check("user/item axes", matrix.shape == (3, 5))
    q2 = item_index["question:q2"]
    check(
        "duplicate kinds aggregate to the strongest weight",
        matrix[users.index("a"), q2] == train.KIND_WEIGHTS["favorite"],
    )

    model = ItemItemRecommender(K=20)
    model.fit(matrix, show_progress=False)

    user_items = [set(matrix.getrow(position).indices) for position in range(len(users))]
    collected = {}
    for position, actor in enumerate(users):
        # The exact loop shape train.py runs: per-user row slice, then the
        # zero-score / own-item truncation.
        ids, scores = model.recommend(
            position, matrix[position], N=train.TOP_N, filter_already_liked_items=True
        )
        entries = []
        for item, score in zip(ids, scores):
            if float(score) <= 0.0 or item in user_items[position]:
                break
            entries.append(
                (
                    items[item],
                    train.reason_for(model.similarity, user_items[position], item, TITLES, items),
                )
            )
        collected[actor] = entries

    check("cross-taste discovery for a (b's exclusive claim)", [e[0] for e in collected["a"]] and collected["a"][0][0] in ("claim:c9", "claim:c8"))
    check("no self-recommendation anywhere", all(
        entry[0] not in {row[1] for row in ROWS if row[0] == actor}
        for actor, entries in collected.items()
        for entry in entries
    ))
    check("reasons resolve to the trigger title", all(
        entry[1] is None or entry[1].startswith("near your item: ")
        for entries in collected.values()
        for entry in entries
    ))
    check("b (tasted everything) gets no padding", collected["b"] == [] or all(
        entry[0] not in {row[1] for row in ROWS if row[0] == "b"} for entry in collected["b"]
    ))

    reason = train.reason_for(model.similarity, user_items[users.index("a")], item_index["claim:c9"], TITLES, items)
    check("reason for a -> c9 names a liked item", reason is not None and reason.startswith("near your item: Q"))

    print("selftest green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
