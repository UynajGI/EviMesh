# @evimesh/signatures

Client and server signing primitives and Envelope specifications.

`generateEd25519KeyPair()` returns an Ed25519 keypair as base64url-encoded
SPKI public-key DER and PKCS#8 private-key DER. The private key is never logged
or persisted by this package; callers decide how to protect it.
