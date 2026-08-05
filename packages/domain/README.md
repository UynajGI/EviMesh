# @evimesh/domain

Scientific objects, lifecycle rules, and domain services.

`ensureActorForIdentity()` provisions a human Actor and its provider Identity
inside a repository transaction on first login. The repository is injected so
the domain service stays independent of a specific database driver.

`updateOwnActorProfile()` accepts only profile fields and requires the
repository to enforce the authenticated `actor_id` predicate in its update.

`registerActorSigningKey()` permits one active Ed25519 key per Actor; key
revocation and rotation are separate domain operations.
