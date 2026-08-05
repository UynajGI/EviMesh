# @evimesh/signatures

Client and server signing primitives and Envelope specifications.

`generateEd25519KeyPair()` returns an Ed25519 keypair as base64url-encoded
SPKI public-key DER and PKCS#8 private-key DER. The private key is never logged
or persisted by this package; callers decide how to protect it.

`encodeEd25519DidKey()` and `decodeEd25519DidKey()` convert that public-key
encoding to and from an Ed25519 `did:key` using base58btc multibase.

`signEd25519Payload()` signs protocol `signing_bytes` and returns a base64url
signature; it does not canonicalize or retain the private key.
