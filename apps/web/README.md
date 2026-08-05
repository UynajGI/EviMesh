# @evimesh/web

The static entry point includes email/password and GitHub sign-in. Set
`window.EVIMESH_CONFIG = { supabaseUrl, anonKey }` before `/app.js`; only the
public Supabase key belongs in this browser configuration. Sessions are kept in
`localStorage` and restored on page refresh.
