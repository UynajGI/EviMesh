# Local Supabase Project

The repository now contains the Supabase CLI project configuration at
[`supabase/config.toml`](../supabase/config.toml). It is local-only and is not
linked to a hosted project.

After Docker Desktop is installed, start the local Supabase stack with:

```powershell
supabase start
supabase status
```

Reset the local database after adding migrations with:

```powershell
supabase db reset
```

Remote project operations are intentionally separate:

```powershell
supabase login
supabase link --project-ref <development-project-ref>
supabase db push
```

Do not commit access tokens, project secrets, or a hosted project reference as
an environment-specific constant. The existing `EviMesh` hosted project is
used for development and staging, while `EviMesh-Production` is provisioned as
the production project. Both hosted projects are separate from this local
configuration.
