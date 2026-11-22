-- Run once in Supabase → SQL Editor. Safe to run more than once.
-- Each customer's my.ebtq.io short link to their account portal
-- (my.erendirasboutique.com/account?t=TOKEN), made the first time someone
-- presses "Copy portal link" and reused after.
alter table shipping_customers add column if not exists account_short_url text;
