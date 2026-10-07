// Offline review artifact, generated from the same SQL template used by the app.
// Does not connect to Supabase, create invitations, or send email.
import { PGlite } from '@electric-sql/pglite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { agreementPdf } from '../src/lib/referralAgreements.ts';

const db = new PGlite();
const migration = await readFile(new URL('../supabase/migrations/20261007120000_private_referral_agreements.sql', import.meta.url), 'utf8');
await db.exec('create table public.patient_submissions(id uuid primary key);');
await db.exec(migration.slice(0, migration.indexOf('create function public.referral_lock_record')));
await db.query('insert into referral_accounts(name,email) values($1,$2)', [process.env.REFERRAL_PREVIEW_NAME || 'Sample Referrer', process.env.REFERRAL_PREVIEW_EMAIL || 'referrer@example.com']);
await db.exec(`insert into public.referral_agreements(account_id,version) select id,1 from public.referral_accounts;
  update public.referral_agreements a set terms=public.referral_contract_text(a);`);
const { rows: [draft] } = await db.query('select * from referral_agreements');
const destination = new URL('../artifacts/referral-agreements/', import.meta.url);
await mkdir(destination, { recursive: true });
await writeFile(new URL('referral-review.pdf', destination), await agreementPdf(draft));
await writeFile(new URL('referral-review.txt', destination), `DRAFT FOR ADMIN REVIEW - NOT ISSUED OR SIGNED\n\n${draft.terms}`);
await db.close();
console.log('Created artifacts/referral-agreements/referral-review.pdf and referral-review.txt. No external actions.');
