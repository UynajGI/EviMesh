# Platform signing key rotation

1. Generate a new Ed25519 key pair in the approved secret manager; do not copy
   the private key into source control or an Event payload.
2. Build the next keyring with `rotatePlatformKeyring`, using the active old
   private key only to sign its key-rotation declaration.
3. Persist and publish the new keyring before issuing a Receipt with the new
   `key_id`. Keep the old public key in `retiredKeys` indefinitely while any
   historical Receipt references it.
4. Verify a representative old Receipt and a new Receipt through
   `verifyPlatformReceiptWithKeyring`; both must succeed by their embedded
   `server_signature.key_id`.
5. Record the signed declaration, operator identity, and verification evidence
   in the platform audit trail. A suspected compromise follows the dedicated
   incident runbook when it is introduced; do not silently replace a key.
