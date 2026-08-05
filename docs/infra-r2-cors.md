# EviMesh R2 CORS Policies

M2-14 and M2-15 use one explicit Web origin per environment. Wildcard origins
are not allowed. The renderer emits the current Wrangler R2 policy format:
`rules` with nested lowercase `allowed` fields.

Render a policy after setting the corresponding hosted origin:

```powershell
$env:EVIMESH_WEB_DEV_ORIGIN="https://dev.example.invalid"
node scripts/render-r2-cors.mjs development | Out-File -Encoding utf8 .tmp/r2-cors-dev.json

$env:EVIMESH_WEB_PRODUCTION_ORIGIN="https://example.invalid"
node scripts/render-r2-cors.mjs production | Out-File -Encoding utf8 .tmp/r2-cors-production.json
```

Apply the generated file only after selecting the intended bucket and checking
the origin:

```powershell
pnpm dlx wrangler r2 bucket cors set <bucket-name> --file .tmp/r2-cors-dev.json
```

The generated rule permits `GET`, `HEAD`, and `PUT`, accepts only
`Content-Type`, exposes `ETag`, and caches preflight responses for one hour.
The actual bucket update remains an account-authorized operation.
