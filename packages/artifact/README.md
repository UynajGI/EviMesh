# @evimesh/artifact

The package provides the storage boundary for Artifact, Evidence, and Run
Receipt objects. `src/hash.mjs` computes SHA-256 digests from async streams
without buffering the complete object and derives stable content-addressed R2
keys for artifact revisions.

`src/upload-verification.mjs` verifies an R2 object's reported size and
streamed SHA-256 digest before the object can be accepted as an Artifact.

`src/upload-session.mjs` builds bounded single-upload plans and manages R2
multipart sessions, including expiry, ordered unique parts, completion, and
abort operations.

`src/download-redirect.mjs` builds short-lived signed GET redirects for
content-addressed Artifact revisions.

科研 Artifact、Evidence、Run Receipt 与对象存储边界。当前为骨架包。
