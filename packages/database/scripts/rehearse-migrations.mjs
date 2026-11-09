/* Rehearse Drizzle migrations against a disposable PostgreSQL database.
 *
 * Usage:
 *   psql "$DB" -f scripts/rehearsal/supabase-shim.sql   # once per database
 *   DB=postgres://postgres@127.0.0.1:55432/rehearsal [FROM=86] [TO=89] node scripts/rehearse-migrations.mjs
 *
 * Each migration runs in its own transaction, split on statement-breakpoint
 * markers. The shim mirrors hosted Supabase: browser roles, an auth schema,
 * and pgcrypto installed in `extensions` (not `public`). Never point DB at a
 * hosted database; production deltas are applied deliberately, one file at a time.
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const root = new URL('../drizzle/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', root), 'utf8'));
const sql = postgres(process.env.DB, { max: 1, onnotice: () => {} });
const from = Number(process.env.FROM ?? 0), to = Number(process.env.TO ?? 999);
for (const entry of journal.entries.filter((e) => e.idx >= from && e.idx <= to)) {
  const text = readFileSync(new URL(`${entry.tag}.sql`, root), 'utf8');
  const parts = text.split('--> statement-breakpoint').map((p) => p.trim()).filter(Boolean);
  try {
    await sql.begin(async (tx) => { await tx.unsafe("SET search_path = public, extensions"); for (const p of parts) await tx.unsafe(p); });
    console.log('ok  ', entry.tag);
  } catch (error) {
    console.log('FAIL', entry.tag, '-', error.message.split('\n')[0]);
    await sql.end(); process.exit(1);
  }
}
await sql.end();
