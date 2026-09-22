// Prueft die RLS-Policies der Migration gegen Postgres als WASM (PGlite), ohne Supabase-Konto.
// Einmal: npm i --no-save @electric-sql/pglite — dann: node supabase/tests/rls-check.mjs supabase/migrations/20260921120000_better_fit.sql
// Erwartet: jede Person sieht nur ihre Zeilen; fremde und direkte Mahlzeiten-Schreibversuche scheitern.
// Bewusst keine Abhaengigkeit des Projekts: nur fuer diese Pruefung mit --no-save installieren.
// eslint-disable-next-line import/no-unresolved
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
await db.exec(`
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated;`);
await db.exec(readFileSync(process.argv[2], 'utf8'));
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function auth.uid() to authenticated;
insert into auth.users values ('${A}'),('${B}');
insert into public.food_catalog (id, source, source_id, names, kcal, protein_g, carbs_g, fat_g) values ('mock:banana','mock','banana','{"de":"Banane"}',89,1.1,20.2,0.3);
insert into public.meals (user_id, day, slot, name, source, kcal, protein_g, carbs_g, fat_g) values ('${A}','2026-09-21','lunch','A','manual',400,20,40,10),('${B}','2026-09-21','lunch','B','manual',500,20,40,10);
insert into public.recipes (user_id, title, servings) values ('${A}','Kuchen A',8);`);
const as = async (sub, sql) => { await db.exec(`reset role; set request.jwt.claim.sub = '${sub}'; set role authenticated;`); try { return (await db.query(sql)).rows; } catch (e) { return 'ERR ' + e.message; } };
const results = {
  aSeesOwnMeals: await as(A, 'select name from public.meals'),
  bSeesOwnMeals: await as(B, 'select name from public.meals'),
  bUpdatesA: await as(B, `update public.meals set name='x' where user_id='${A}' returning id`),
  bInsertsMealDirect: await as(B, `insert into public.meals (user_id, day, slot, name, source, kcal, protein_g, carbs_g, fat_g) values ('${B}','2026-09-21','lunch','fake','manual',1,1,1,1) returning id`),
  bInsertsWeightForA: await as(B, `insert into public.weight_entries (user_id, day, weight_kg) values ('${A}','2026-09-21',80) returning id`),
  bInsertsOwnWeight: await as(B, `insert into public.weight_entries (user_id, day, weight_kg) values ('${B}','2026-09-21',80) returning id`),
  bAddsItemToARecipe: await as(B, `insert into public.recipe_items (recipe_id, user_id, food_id, amount, unit, grams) select id, '${B}', 'mock:banana', 1, 'piece', 120 from public.recipes limit 1 returning id`),
  bReadsARecipesCount: await as(B, 'select count(*) from public.recipes'),
  catalogReadable: await as(B, 'select id from public.food_catalog'),
  bCustomFoodForA: await as(B, `insert into public.food_catalog (id, source, source_id, owner_id, names, kcal, protein_g, carbs_g, fat_g) values ('custom:x','custom','x','${A}','{}',100,1,1,1)`),
  anonymousReads: await (async () => { await db.exec(`reset role; set request.jwt.claim.sub = ''; set role authenticated;`); return (await db.query('select count(*) from public.meals')).rows; })(),
};
console.log(JSON.stringify(results, null, 1));
