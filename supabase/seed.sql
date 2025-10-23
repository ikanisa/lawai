-- Development seed data for the francophone lawyer AI agent domain.
-- Seeds are idempotent: re-running `supabase db reset` will not duplicate rows.
WITH
  lawyer_profile AS (
    SELECT
      id
    FROM
      public.profiles
    WHERE
      role = 'lawyer'
    ORDER BY
      created_at
    LIMIT
      1
  ),
  client_profile AS (
    SELECT
      id
    FROM
      public.profiles
    WHERE
      role = 'client'
    ORDER BY
      created_at
    LIMIT
      1
  ),
  inserted_case AS (
    INSERT INTO
      public.cases (
        owner_id,
        title,
        summary,
        status,
        jurisdiction,
        matter_type,
        tags
      )
    SELECT
      lp.id,
      'Dossier exemple - Contrat SaaS',
      'Analyse et rédaction d''un contrat de services SaaS pour un client B2B.',
      'in_review',
      'France',
      'Contrat commercial',
      ARRAY['contrat', 'SaaS']
    FROM
      lawyer_profile lp
    WHERE
      NOT EXISTS (
        SELECT
          1
        FROM
          public.cases c
        WHERE
          c.title = 'Dossier exemple - Contrat SaaS'
      )
    RETURNING
      id
  )
SELECT
  1;

-- Collaborator list: ensure the client profile is attached to the example case.
WITH
  example_case AS (
    SELECT
      id
    FROM
      public.cases
    WHERE
      title = 'Dossier exemple - Contrat SaaS'
    LIMIT
      1
  ),
  client_profile AS (
    SELECT
      id
    FROM
      public.profiles
    WHERE
      role = 'client'
    ORDER BY
      created_at
    LIMIT
      1
  ),
  owner_profile AS (
    SELECT
      owner_id AS id
    FROM
      public.cases
    WHERE
      title = 'Dossier exemple - Contrat SaaS'
    LIMIT
      1
  )
INSERT INTO
  public.case_collaborators (case_id, profile_id, role, added_by)
SELECT
  ec.id,
  cp.id,
  'client'::public.case_collaborator_role,
  op.id
FROM
  example_case ec
  JOIN client_profile cp ON TRUE
  JOIN owner_profile op ON TRUE
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.case_collaborators cc
    WHERE
      cc.case_id = ec.id
      AND cc.profile_id = cp.id
  );

-- Attach sample documents to the example case.
WITH
  example_case AS (
    SELECT
      id
    FROM
      public.cases
    WHERE
      title = 'Dossier exemple - Contrat SaaS'
    LIMIT
      1
  )
INSERT INTO
  public.case_documents (
    case_id,
    title,
    doc_type,
    language,
    storage_path,
    content_preview
  )
SELECT
  ec.id,
  'Projet de contrat SaaS',
  'draft_contract',
  'fr',
  'documents/exemple/projet-contrat-saas.pdf',
  'Clause de résiliation, responsabilité, SLA. Version à relire.'
FROM
  example_case ec
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.case_documents d
    WHERE
      d.title = 'Projet de contrat SaaS'
  );

-- Seed a conversation history for the example case.
WITH
  example_case AS (
    SELECT
      id
    FROM
      public.cases
    WHERE
      title = 'Dossier exemple - Contrat SaaS'
    LIMIT
      1
  ),
  client_profile AS (
    SELECT
      id
    FROM
      public.profiles
    WHERE
      role = 'client'
    ORDER BY
      created_at
    LIMIT
      1
  ),
  lawyer_profile AS (
    SELECT
      id
    FROM
      public.profiles
    WHERE
      role = 'lawyer'
    ORDER BY
      created_at
    LIMIT
      1
  )
INSERT INTO
  public.case_messages (case_id, actor, sender_id, content, model)
SELECT
  *
FROM
  (
    VALUES
      (
        (
          SELECT
            id
          FROM
            example_case
        ),
        'client'::public.message_actor,
        (
          SELECT
            id
          FROM
            client_profile
        ),
        'Pouvez-vous vérifier que les clauses de pénalité sont conformes ?',
        NULL
      ),
      (
        (
          SELECT
            id
          FROM
            example_case
        ),
        'assistant'::public.message_actor,
        NULL,
        'Oui, je vais analyser les clauses et suggérer des ajustements.',
        'gpt-4o-mini'
      ),
      (
        (
          SELECT
            id
          FROM
            example_case
        ),
        'lawyer'::public.message_actor,
        (
          SELECT
            id
          FROM
            lawyer_profile
        ),
        'Merci, pourrais-tu ajouter une clause spécifique pour la protection des données ?',
        NULL
      )
  ) AS msg (case_id, actor, sender_id, content, model)
WHERE
  EXISTS (
    SELECT
      1
    FROM
      example_case
  )
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.case_messages m
    WHERE
      m.case_id = (
        SELECT
          id
        FROM
          example_case
      )
      AND m.content LIKE 'Pouvez-vous vérifier%'
  );

-- Seed a task backlog connected to the example case.
WITH
  example_case AS (
    SELECT
      id
    FROM
      public.cases
    WHERE
      title = 'Dossier exemple - Contrat SaaS'
    LIMIT
      1
  )
INSERT INTO
  public.tasks (case_id, title, description, due_date, status)
SELECT
  *
FROM
  (
    VALUES
      (
        (
          SELECT
            id
          FROM
            example_case
        ),
        'Revue des clauses de pénalité',
        'Comparer avec la jurisprudence récente et proposer formulations.',
        current_date + interval '2 days',
        'in_progress'
      ),
      (
        (
          SELECT
            id
          FROM
            example_case
        ),
        'Vérifier conformité RGPD',
        'S''assurer que la collecte et le traitement des données respectent le règlement.',
        current_date + interval '5 days',
        'todo'
      )
  ) AS task (case_id, title, description, due_date, status)
WHERE
  EXISTS (
    SELECT
      1
    FROM
      example_case
  )
  AND NOT EXISTS (
    SELECT
      1
    FROM
      public.tasks t
    WHERE
      t.case_id = (
        SELECT
          id
        FROM
          example_case
      )
      AND t.title = 'Revue des clauses de pénalité'
  );
