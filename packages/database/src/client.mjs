import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { schema } from './schema.mjs';

export function createDatabaseClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to create a database client');
  }

  const client = postgres(databaseUrl);
  return { client, db: drizzle({ client, schema }) };
}
