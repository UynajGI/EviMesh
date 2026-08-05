# @evimesh/domain

Scientific objects, lifecycle rules, and domain services.

`ensureActorForIdentity()` provisions a human Actor and its provider Identity
inside a repository transaction on first login. The repository is injected so
the domain service stays independent of a specific database driver.

`updateOwnActorProfile()` accepts only profile fields and requires the
repository to enforce the authenticated `actor_id` predicate in its update.

`registerActorSigningKey()` and `revokeActorSigningKey()` enforce one active
Ed25519 key per Actor; rotation declarations are a separate domain operation.

`createActorApiToken()` returns the generated plaintext once and persists only
its digest, prefix, scopes, and expiry metadata through the injected repository.
