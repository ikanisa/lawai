-- Development seed data for the francophone lawyer AI agent domain.
-- Seeds are idempotent: re-running `supabase db reset` will not duplicate rows.

with lawyer_profile as (
  select id
  from public.profiles
  where role = 'lawyer'
  order by created_at
  limit 1
),
client_profile as (
  select id
  from public.profiles
  where role = 'client'
  order by created_at
  limit 1
),
inserted_case as (
  insert into public.cases (owner_id, title, summary, status, jurisdiction, matter_type, tags)
  select
    lp.id,
    'Dossier exemple - Contrat SaaS',
    'Analyse et rédaction d''un contrat de services SaaS pour un client B2B.',
    'in_review',
    'France',
    'Contrat commercial',
    array['contrat', 'SaaS']
  from lawyer_profile lp
  where not exists (
    select 1 from public.cases c where c.title = 'Dossier exemple - Contrat SaaS'
  )
  returning id
)
select 1;

-- Collaborator list: ensure the client profile is attached to the example case.
with example_case as (
  select id from public.cases where title = 'Dossier exemple - Contrat SaaS' limit 1
),
client_profile as (
  select id from public.profiles where role = 'client' order by created_at limit 1
),
owner_profile as (
  select owner_id as id from public.cases where title = 'Dossier exemple - Contrat SaaS' limit 1
)
insert into public.case_collaborators (case_id, profile_id, role, added_by)
select ec.id, cp.id, 'client', op.id
from example_case ec
join client_profile cp on true
join owner_profile op on true
where not exists (
  select 1 from public.case_collaborators cc
  where cc.case_id = ec.id and cc.profile_id = cp.id
);

-- Attach sample documents to the example case.
with example_case as (
  select id from public.cases where title = 'Dossier exemple - Contrat SaaS' limit 1
)
insert into public.documents (case_id, title, doc_type, language, storage_path, content_preview)
select
  ec.id,
  'Projet de contrat SaaS',
  'draft_contract',
  'fr',
  'documents/exemple/projet-contrat-saas.pdf',
  'Clause de résiliation, responsabilité, SLA. Version à relire.'
from example_case ec
where not exists (
  select 1 from public.documents d where d.title = 'Projet de contrat SaaS'
);

-- Seed a conversation history for the example case.
with example_case as (
  select id from public.cases where title = 'Dossier exemple - Contrat SaaS' limit 1
),
client_profile as (
  select id from public.profiles where role = 'client' order by created_at limit 1
),
lawyer_profile as (
  select id from public.profiles where role = 'lawyer' order by created_at limit 1
)
insert into public.case_messages (case_id, actor, sender_id, content, model)
select * from (
  values
    ((select id from example_case), 'client', (select id from client_profile), 'Pouvez-vous vérifier que les clauses de pénalité sont conformes ?', null),
    ((select id from example_case), 'assistant', null, 'Oui, je vais analyser les clauses et suggérer des ajustements.', 'gpt-4o-mini'),
    ((select id from example_case), 'lawyer', (select id from lawyer_profile), 'Merci, pourrais-tu ajouter une clause spécifique pour la protection des données ?', null)
) as msg(case_id, actor, sender_id, content, model)
where exists (select 1 from example_case)
and not exists (
  select 1 from public.case_messages m
  where m.case_id = (select id from example_case)
    and m.content like 'Pouvez-vous vérifier%'
);

-- Seed a task backlog connected to the example case.
with example_case as (
  select id from public.cases where title = 'Dossier exemple - Contrat SaaS' limit 1
)
insert into public.tasks (case_id, title, description, due_date, status)
select * from (
  values
    ((select id from example_case), 'Revue des clauses de pénalité', 'Comparer avec la jurisprudence récente et proposer formulations.', current_date + interval '2 days', 'in_progress'),
    ((select id from example_case), 'Vérifier conformité RGPD', 'S''assurer que la collecte et le traitement des données respectent le règlement.', current_date + interval '5 days', 'todo')
) as task(case_id, title, description, due_date, status)
where exists (select 1 from example_case)
and not exists (
  select 1 from public.tasks t
  where t.case_id = (select id from example_case)
    and t.title = 'Revue des clauses de pénalité'
);
