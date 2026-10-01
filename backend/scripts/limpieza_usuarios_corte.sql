-- LIMPIEZA DE USUARIOS BASURA PARA EL CORTE (archiva y borra). Ejecutar SOLO en el corte o sobre una copia.
-- Reversible: todo queda en tablas *_archivo_corte.
begin;
create temp table cand on commit drop as
select u.id from users u
where (
    (u.name ~* '^cliente crm #' and u.crm_id ~ '^[0-9]+$' and not exists (select 1 from crm_profile_fields f where f.crm_id = cast(u.crm_id as int)))
 or (u.name ~* '^\s*(no match|not approved|no hay gente|no hay|aprobado|refund|descalificado|trouble|hecho|listo para match|pendiente|revisar)')
 or (exists (select 1 from leads_pendientes_entrevista l where l.user_id = u.id and coalesce(l.city,'') = '' and l.age is null
                and coalesce(l.gender,'') = '' and coalesce(l.occupation,'') = '')
     and coalesce(u.email,'') = '' and (coalesce(u.phone,'') = '' or u.phone like '+5730000%')
     and not exists (select 1 from profiles p where p.user_id = u.id)))
  -- nunca si tiene datos con valor
  and not exists (select 1 from stripe_payments x where x.user_id = u.id)
  and not exists (select 1 from client_notes x where x.user_id = u.id)
  and not exists (select 1 from interview_appointments x where x.user_id = u.id)
  and not exists (select 1 from client_extended_profile x where x.user_id = u.id)
  and not exists (select 1 from accounts_receivable x where x.user_id = u.id)
  and not exists (select 1 from event_attendees x where x.user_id = u.id)
  and not exists (select 1 from users m where m.merged_into_id = u.id)
  and not exists (select 1 from crm_client_aliases a where a.user_id = u.id)
  and not exists (select 1 from user_accounts ua where lower(ua.email) = lower(coalesce(u.email, '-')));

create table if not exists users_archivo_corte as select * from users where false;
create table if not exists profiles_archivo_corte as select * from profiles where false;
create table if not exists leads_archivo_corte as select * from leads_pendientes_entrevista where false;
insert into users_archivo_corte select u.* from users u join cand c on c.id = u.id;
insert into profiles_archivo_corte select p.* from profiles p join cand c on c.id = p.user_id;
insert into leads_archivo_corte select l.* from leads_pendientes_entrevista l join cand c on c.id = l.user_id;

update operational_matches set user_id_a = null where user_id_a in (select id from cand);
update operational_matches set user_id_b = null where user_id_b in (select id from cand);
update historical_matches set user_id_a = null where user_id_a in (select id from cand);
update historical_matches set user_id_b = null where user_id_b in (select id from cand);
update priority_client_tracking set user_id = null where user_id in (select id from cand);
update priority_client_tracking set candidate_id = null where candidate_id in (select id from cand);
update cs_novedades set client_id = null where client_id in (select id from cand);
update crm_profile_fields set user_id = null where user_id in (select id from cand);
delete from leads_pendientes_entrevista where user_id in (select id from cand);
delete from users where id in (select id from cand);   -- profiles, embeddings, etc. se borran en cascada (ya archivados)
select (select count(*) from users_archivo_corte) usuarios_archivados, (select count(*) from users) usuarios_restantes;
commit;
