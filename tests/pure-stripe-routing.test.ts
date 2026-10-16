import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('Pure Stripe routing preserves other stores, unpublished products, prices and commissions', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create table distributors(id integer primary key, slug text, is_active boolean);
      create table rx_plus_products(id integer primary key, active boolean);
      create table distributor_products(distributor_id integer, product_id integer,
        is_enabled boolean, enabled boolean, processor_eligibility text,
        custom_price numeric default 125, commission_rate numeric default .65,
        updated_at timestamptz default '2026-10-01');
      insert into distributors values (1,'purepeptidelabs',true),(2,'other',true);
      insert into rx_plus_products select n,true from generate_series(1,38) n;
      insert into distributor_products(distributor_id,product_id,is_enabled,enabled,processor_eligibility)
        select 1,n,true,true,'alternate_processor' from generate_series(1,37) n;
      insert into distributor_products(distributor_id,product_id,is_enabled,enabled,processor_eligibility)
        values(1,38,false,false,'alternate_processor'),(2,1,true,true,'alternate_processor');
    `);
    const sql = readFileSync('supabase/migrations/20261016193000_enable_pure_shared_stripe_checkout.sql','utf8');
    const before = (await db.query('select * from distributor_products order by distributor_id,product_id')).rows;
    await db.exec(sql);
    const after = (await db.query('select * from distributor_products order by distributor_id,product_id')).rows;
    for (let i=0;i<after.length;i++) {
      const old = before[i], next = after[i];
      if(old.distributor_id === 1 && old.is_enabled) {
        assert.equal(next.processor_eligibility,'stripe_approved');
        assert.deepEqual({...next,processor_eligibility:old.processor_eligibility,updated_at:old.updated_at},old);
      } else assert.deepEqual(next,old);
    }
    await db.exec(sql);
    assert.deepEqual((await db.query('select * from distributor_products order by distributor_id,product_id')).rows,after);
    await db.exec('update distributor_products set enabled=false where distributor_id=1 and product_id=1');
    await assert.rejects(db.exec(sql), /Expected 37 published Pure products/);
  } finally { await db.close(); }
});
