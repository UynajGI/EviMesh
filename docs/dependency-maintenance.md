# Dependency maintenance

Dependabot opens grouped version-update PRs monthly: one npm workspace group
and one GitHub Actions group. Security updates have separate groups and remain
enabled; they are not delayed until the monthly version-update schedule.

The previous weekly configuration created separate PRs for each dependency,
with up to ten npm PRs open. Merging or closing them freed slots for more PRs.
Grouping reduces this recurring review queue without hiding security updates.

Review and merge the monthly groups after CI passes. Branch protection still
requires an independent approval and an up-to-date branch; this policy does
not automatically approve or merge dependency changes. Major updates are
included and require compatibility review as part of the group.

The September 2026 maintenance batch consolidates PRs #94, #95, #115–#121.
PR #122 duplicates the Hono update but omits the workspace lockfile. PR #114
only changes lockfile deprecation URLs: esbuild was already at 0.28.2 on main.
PR #123 is outside this maintenance batch.

Reference: https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference
