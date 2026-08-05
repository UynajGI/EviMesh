# @evimesh/cli

`startDeviceLogin()` and `pollDeviceLogin()` implement the device-code
contract. `saveLimitedToken()` accepts only the CLI read scopes
`profile:read` and `project:read`; it never persists a broad token.
