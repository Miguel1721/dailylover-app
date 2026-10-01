-- SIMULACIÓN DE LIMPIEZA PARA EL CORTE (solo lectura)
create temp table cand as
select u.id, u.name,
  case
    when u.name ~* '^cliente crm #' and u.crm_id ~ '^[0-9]+$' and not exists (select 1 from crm_profile_fields f where f.crm_id = cast(u.crm_id as int)) then 'A. Marcador "Cliente CRM #" de un cliente que ya no existe en el CRM'
    when u.name ~* '^\s*(no match|not approved|no hay gente|no hay|aprobado|refund|descalificado|trouble|hecho|listo para match|pendiente|revisar)' then 'B. Estado de la hoja guardado como si fuera una persona'
    when exists (select 1 from leads_pendientes_entrevista l where l.user_id = u.id
                   and coalesce(l.city,'') = '' and l.age is null and coalesce(l.gender,'') = '' and coalesce(l.occupation,'') = '')
         and coalesce(u.email,'') = '' and (coalesce(u.phone,'') = '' or u.phone like '+5730000%')
         and not exists (select 1 from profiles p where p.user_id = u.id) then 'C. Lead vacío (sin datos, sin correo, teléfono falso)'
  end tipo
from users u;
delete from cand where tipo is null;
alter table cand add column bloqueo text;
update cand c set bloqueo = concat_ws(', ',
  case when exists (select 1 from stripe_payments x where x.user_id=c.id) then 'tiene pagos' end,
  case when exists (select 1 from client_notes x where x.user_id=c.id) then 'tiene notas' end,
  case when exists (select 1 from interview_appointments x where x.user_id=c.id) then 'tiene entrevistas' end,
  case when exists (select 1 from client_extended_profile x where x.user_id=c.id) then 'tiene F1/F2' end,
  case when exists (select 1 from accounts_receivable x where x.user_id=c.id) then 'tiene cartera' end,
  case when exists (select 1 from event_attendees x where x.user_id=c.id) then 'asistió a eventos' end,
  case when exists (select 1 from users m where m.merged_into_id=c.id) then 'otros fusionados en él' end);
\echo '== Resultado'
select tipo, count(*) total, count(*) filter (where bloqueo='') se_archivan, count(*) filter (where bloqueo<>'') se_conservan,
       count(*) filter (where exists (select 1 from operational_matches m where m.user_id_a=cand.id or m.user_id_b=cand.id)) aparecen_en_mesas
from cand group by 1 order by 1;
\echo '== Motivos para conservar'
select bloqueo, count(*) from cand where bloqueo<>'' group by 1;
\echo '== Ejemplos por tipo'
select tipo, string_agg(left(name,28), ' | ') from (select tipo, name, row_number() over (partition by tipo order by random()) r from cand) x where r <= 4 group by 1;
