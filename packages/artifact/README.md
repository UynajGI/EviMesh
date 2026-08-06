# @evimesh/artifact

The package provides the storage boundary for Artifact, Evidence, and Run
Receipt objects. `src/hash.mjs` computes SHA-256 digests from async streams
without buffering the complete object and derives stable content-addressed R2
keys for artifact revisions.

`src/upload-verification.mjs` verifies an R2 object's reported size and
streamed SHA-256 digest before the object can be accepted as an Artifact.

科研 Artifact、Evidence、Run Receipt 与对象存储边界。当前为骨架包。
