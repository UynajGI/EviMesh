import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const drizzleUrl = new URL('../drizzle/', import.meta.url);
const journalPath = fileURLToPath(new URL('../drizzle/meta/_journal.json', import.meta.url));

test('M3-69 migration chain is complete and rollback-safe at the file boundary', async () => {
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  const entries = journal.entries;
  const files = (await readdir(drizzleUrl)).filter((file) => /^\d{4}_.*\.sql$/.test(file)).sort();

  assert.equal(entries.length, files.length);
  assert.deepEqual(entries.map((entry) => entry.idx), entries.map((_, index) => index));
  assert.equal(new Set(entries.map((entry) => entry.tag)).size, entries.length);

  for (const [index, entry] of entries.entries()) {
    const migration = await readFile(new URL(`${files[index]}`, drizzleUrl), 'utf8');
    assert.match(migration, /\S/);
    assert.equal(entry.tag, files[index].replace(/\.sql$/, '').replace(/^\d{4}_/, `${String(index).padStart(4, '0')}_`));
  }
});
