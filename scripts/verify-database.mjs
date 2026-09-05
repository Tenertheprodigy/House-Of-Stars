import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();

const bootstrapSql = `
  create role authenticated;
  create role service_role;
  create role anon;
  create schema auth;
  create schema storage;
  create table auth.users (id uuid primary key);
  create table storage.buckets (id text primary key, name text not null, public boolean not null);
  create table storage.objects (id bigint generated always as identity primary key, bucket_id text, name text);
  alter table storage.objects enable row level security;
  create or replace function storage.foldername(name text)
  returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:-1]
  $$;
  create or replace function auth.uid()
  returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to authenticated, service_role;
  grant usage on schema storage to authenticated, service_role;
  grant execute on function auth.uid() to authenticated, service_role;
`;

const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const verification = await readFile(
  new URL("../supabase/tests/order_platform.test.sql", import.meta.url),
  "utf8",
);

try {
  await database.exec(bootstrapSql);
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(
      new URL(migrationFile, migrationsDirectory),
      "utf8",
    );
    await database.exec(migration);
  }
  await database.exec(verification);
  console.info("Database migration and SQL verification passed.");
} finally {
  await database.close();
}
