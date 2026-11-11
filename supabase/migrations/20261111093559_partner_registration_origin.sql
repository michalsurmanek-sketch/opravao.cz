alter table public.opravao_partners
  add column registration_origin text not null default 'unknown'
    constraint opravao_partners_registration_origin_check check (registration_origin in ('self_registered','admin','unknown')),
  add column registration_lead_id uuid references public.plotao_leads(id) on delete set null,
  add column registered_by text;
comment on column public.opravao_partners.registration_origin is 'Original source of partner registration; assigned by trusted server paths and preserved on edits.';
comment on column public.opravao_partners.registration_lead_id is 'Original company registration submitted through the Opravao form.';
comment on column public.opravao_partners.registered_by is 'Admin actor email for manually created profiles; not supplied by the browser.';
with evidence as (
  select distinct on (p.id) p.id,l.id as lead_id
  from public.opravao_partners p
  join public.plotao_leads l on l.source='opravao.cz'
    and l.payload->>'registrationType'='company'
    and l.payload->>'ico'=p.ico
    and lower(l.email)=lower(p.email)
    and l.created_at between p.created_at-interval '5 seconds' and p.created_at
  where p.registration_origin='unknown' and p.ico<>''
  order by p.id,l.created_at
)
update public.opravao_partners p
set registration_origin='self_registered',registration_lead_id=e.lead_id
from evidence e where p.id=e.id;
with first_events as (
  select distinct on (a.entity_id) a.entity_id,a.action,a.actor_email,a.created_at,a.details
  from public.opravao_admin_audit a where a.entity='partner'
  order by a.entity_id,a.created_at
)
update public.opravao_partners p
set registration_origin='admin',registered_by=a.actor_email
from first_events a
where p.id::text=a.entity_id and p.registration_origin='unknown'
  and a.action='save_partner' and a.created_at between p.created_at and p.created_at+interval '5 seconds'
  and coalesce(a.details->>'notes','') not ilike '%formuláře%';