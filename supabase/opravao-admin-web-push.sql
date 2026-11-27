create extension if not exists pg_net with schema extensions;
create table public.opravao_push_config (
 id integer primary key check(id=1), dispatch_secret text not null default encode(extensions.gen_random_bytes(32),'hex'), public_key text, private_key text
);
alter table public.opravao_push_config enable row level security;
revoke all on public.opravao_push_config from public,anon,authenticated;
grant all on public.opravao_push_config to service_role;
insert into public.opravao_push_config(id) values(1);
create table public.opravao_push_subscriptions (
 endpoint text primary key, subscription jsonb not null, updated_at timestamptz not null default now()
);
alter table public.opravao_push_subscriptions enable row level security;
revoke all on public.opravao_push_subscriptions from public,anon,authenticated;
grant all on public.opravao_push_subscriptions to service_role;
create schema if not exists opravao_private;
revoke all on schema opravao_private from public,anon,authenticated;
create function opravao_private.notify_admin_push() returns trigger language plpgsql security definer set search_path='' as $$
declare secret text;
begin
 if TG_TABLE_NAME='plotao_leads' then
  if NEW.source is distinct from 'opravao.cz' then return NEW; end if;
 end if;
 if TG_TABLE_NAME='opravao_partners' then
  if NEW.registration_lead_id is not null or NEW.registration_origin is distinct from 'self_registered' then return NEW; end if;
 end if;
 if not exists(select 1 from public.opravao_push_subscriptions) then return NEW; end if;
 select dispatch_secret into secret from public.opravao_push_config where id=1;
 perform net.http_post(url:='https://jmukoccjqykyoqsypuwb.supabase.co/functions/v1/opravao-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:=jsonb_build_object('action','dispatch','table',TG_TABLE_NAME,'id',NEW.id),timeout_milliseconds:=15000);
 return NEW;
exception when others then
 raise warning 'Opravao push enqueue failed: %', SQLSTATE;
 return NEW;
end $$;
revoke all on function opravao_private.notify_admin_push() from public,anon,authenticated;
create trigger opravao_lead_push after insert on public.plotao_leads for each row execute function opravao_private.notify_admin_push();
create trigger opravao_partner_push after insert on public.opravao_partners for each row execute function opravao_private.notify_admin_push();
