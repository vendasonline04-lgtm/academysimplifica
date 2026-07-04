-- View sem dados pessoais (sem email/nome/telefone/cpf) para o dashboard de métricas ler com a anon key
create or replace view public.cackto_orders_dashboard as
  select status, amount, net_amount, created_at
  from public.cackto_orders;

grant select on public.cackto_orders_dashboard to anon;
