alter table public.opravao_coupon_campaigns add column if not exists archived_at timestamptz;
create index if not exists opravao_coupon_campaigns_archived_at_idx on public.opravao_coupon_campaigns (archived_at) where archived_at is not null;
