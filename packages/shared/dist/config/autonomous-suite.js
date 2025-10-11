export const AUTONOMOUS_JUSTICE_SUITE = {
    autonomous_legal_agent_suite: {
        name: 'Avocat-AI Francophone — Autonomous Justice Suite',
        vision: 'A living, interactive, personal legal assistant that behaves like a seasoned avocat/juriste/greffier/procureur—guiding users through every legal & court process with actionable steps, trusted sources, and agentic tools.',
        default_language: 'fr',
        supported_languages: ['fr', 'en', 'rw'],
        jurisdictions_core: ['FR', 'BE', 'LU', 'CH-FR', 'CA-QC', 'MC', 'OHADA', 'MA', 'TN', 'DZ', 'RW', 'EU'],
        overlays: ['OAPI', 'CIMA'],
        compliance_hard_gates: {
            france_judge_analytics_block: true,
            statute_first: true,
            cite_or_refuse: true,
            ohada_preemption_priority: true,
            maghreb_binding_banner: true,
            confidential_mode: {
                enforced_when: ['org_policy.confidential_mode = true'],
            },
        },
    },
    users: {
        roles: ['owner', 'admin', 'member', 'reviewer', 'viewer', 'compliance_officer', 'auditor'],
        user_types: [
            {
                code: 'avocat_externe',
                label: 'Avocat/Attorney (cabinet)',
                default_role: 'member',
                features: ['Research', 'Drafting', 'Matters', 'Deadlines', 'Citations', 'HITL submit'],
            },
            {
                code: 'juriste_entreprise',
                label: 'Juriste d’entreprise (in-house)',
                default_role: 'member',
                features: ['Research', 'Drafting', 'Benchmarks', 'Policies', 'Matters'],
            },
            {
                code: 'greffier',
                label: 'Greffier/Clerk',
                default_role: 'viewer',
                features: ['Citations', 'Authority Browser', 'Print/Export'],
            },
            {
                code: 'magistrat_assistant',
                label: 'Assistant de juge (Bench support)',
                default_role: 'viewer',
                features: ['Bench memo agent', 'Citations', 'Authority Browser'],
            },
            {
                code: 'ministere_public',
                label: 'Procureur/Ministère public',
                default_role: 'member',
                features: ['Procedural Navigator', 'Drafting (réquisitions)', 'Deadlines', 'Evidence tools'],
            },
            {
                code: 'paralegal',
                label: 'Paralegal/Assistant',
                default_role: 'member',
                features: ['Templates', 'Doc assembly', 'Timeline', 'Filing packets'],
            },
            {
                code: 'citizen_tier',
                label: 'Citoyen/Assistance',
                default_role: 'viewer',
                features: ['Guided Q&A', 'Simple documents', 'Referrals', 'Disclaimers strong'],
            },
        ],
        abac_attributes: ['jurisdiction_entitlements', 'confidential_mode', 'sensitive_topic_hitl', 'residency_zone'],
        permissions_matrix: {
            'research.run': ['member', 'reviewer', 'admin', 'owner'],
            'drafting.edit': ['member', 'reviewer', 'admin', 'owner'],
            'hitl.review': ['reviewer', 'admin', 'owner'],
            'corpus.manage': ['admin', 'owner'],
            'policies.manage': ['admin', 'owner', 'compliance_officer'],
            'billing.manage': ['owner'],
            'audit.read': ['auditor', 'compliance_officer', 'admin', 'owner'],
            'allowlist.toggle': ['admin', 'owner'],
            'residency.change': ['owner'],
            'people.manage': ['admin', 'owner'],
            'data.export_delete': ['owner'],
        },
    },
    agents: {
        orchestrator: {
            code: 'concierge',
            label: 'Concierge Agent (Chef d’orchestre)',
            mission: 'Understands intent, routes to specialist agents, composes plan, supervises tools.',
            key_capabilities: ['intent_detection', 'jurisdiction_routing', 'plan_generation', 'tool_budgeting', 'HITL_triggering'],
        },
        counsel_research: {
            code: 'conseil_recherche',
            label: 'Conseil Recherche (droit civil)',
            mission: 'IRAC/CREAC answers, statute-first, case synthesis with reliability scoring.',
            tools: ['file_search', 'web_search', 'lookupCodeArticle', 'ohadaUniformAct', 'validateCitation'],
        },
        ohada_counsel: {
            code: 'ohada',
            label: 'Conseil OHADA',
            mission: 'Uniform Acts + CCJA first, pre-emption banners, registry & formalities.',
            tools: ['ohadaUniformAct', 'validateCitation', 'deadlineCalculator'],
        },
        eu_overlay: {
            code: 'ue_overlay',
            label: 'Conseil UE/EUR-Lex',
            mission: 'Map directives/regulations; ELI/ECLI normalized; supremacy/conflict notes.',
            tools: ['validateCitation'],
        },
        drafting_studio: {
            code: 'rédaction',
            label: 'Rédaction & Redline',
            mission: 'Generate, redline, and benchmark clauses with legal rationale & citations.',
            tools: ['redlineContract', 'generateTemplate', 'validateCitation'],
        },
        procedural_navigator: {
            code: 'procédure',
            label: 'Navigateur de procédure',
            mission: 'Guided stepper for filings/service/fees/hearings/enforcement per jurisdiction.',
            tools: ['deadlineCalculator', 'limitationCheck', 'court_fees', 'service_of_process', 'hearing_schedule?'],
        },
        bench_memo: {
            code: 'bench',
            label: 'Bench-Memo (Support magistrat)',
            mission: 'Neutral bench memos; options; issue framing; no judge analytics.',
            tools: ['file_search', 'validateCitation'],
        },
        evidence_discovery: {
            code: 'evidence',
            label: 'Preuve & Discovery',
            mission: 'Evidence intake (Drive/OCR), exhibit bundling, cite-check.',
            tools: ['snapshotAuthority', 'document_parser', 'exhibit_bundler'],
        },
        case_analyst: {
            code: 'case_score',
            label: 'Analyste jurisprudence',
            mission: 'Compute case quality (PW/ST/SA/PI/JF/LB/RC/CQ) with rationale and treatment graph.',
            tools: ['computeCaseScore', 'buildTreatmentGraph'],
        },
        deadlines_finance: {
            code: 'calculs',
            label: 'Délais, intérêts & dommages',
            mission: 'Compute deadlines, interests, damages per statute/regulation.',
            tools: ['deadlineCalculator', 'interestCalculator'],
        },
        language_binding: {
            code: 'langue',
            label: 'Langue & Traductions',
            mission: 'Maghreb/Rwanda triage; warn if FR is non-binding; link Arabic/Kinyarwanda/EN.',
            tools: ['checkBindingLanguage'],
        },
        librarian: {
            code: 'bibliothécaire',
            label: 'Bibliothécaire (Corpus Drive)',
            mission: 'Ingest/normalize/summarize legal docs from the secure Drive folder; maintain metadata.',
            tools: ['gdrive_watcher', 'normalize', 'summarize', 'embed', 'vector_upload'],
        },
        negotiation_mediator: {
            code: 'negociation',
            label: 'Négociation/Médiation',
            mission: 'Generate proposals, compare concessions, track risks & fallback positions.',
            tools: ['generateTemplate', 'risk_assessor'],
        },
    },
    agent_settings_schema: {
        common: {
            language_default: { type: 'enum', values: ['fr', 'en', 'rw'], default: 'fr' },
            jurisdictions_default: { type: 'array', values: 'jurisdiction codes' },
            citation_density: { type: 'enum', values: ['low', 'medium', 'high'], default: 'high' },
            risk_threshold: { type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
            hitl_on_high_risk: { type: 'boolean', default: true },
            allow_tools: { type: 'array', values: 'tool codes' },
            time_budget_seconds: { type: 'int', default: 45 },
            result_style: { type: 'enum', values: ['IRAC', 'CREAC', 'Memo', 'Brief'], default: 'IRAC' },
        },
        per_agent_overrides: {
            concierge: {
                plan_visibility: { type: 'boolean', default: true },
            },
            conseil_recherche: {
                opposing_view: { type: 'boolean', default: true },
            },
            ohada: {
                preemption_banner: { type: 'boolean', default: true },
            },
            'procédure': {
                deadline_display: { type: 'enum', values: ['calendar_days', 'court_days'] },
            },
            bench: {
                neutrality_mode: { type: 'boolean', default: true },
            },
        },
    },
    search: {
        modes: ['semantic', 'keyword', 'hybrid'],
        vector: {
            store: 'OpenAI Vector Store + Supabase pgvector mirror',
            embedding_model: 'text-embedding-3-large',
            chunking: {
                statutes: { by: 'article', max_tokens: 1000, overlap: 120 },
                cases: { by: 'paragraph', max_tokens: 1200, overlap: 150 },
                gazettes: { by: 'item', max_tokens: 1000, overlap: 120 },
            },
        },
        query_rewriting: {
            synonyms_source: 'agent_synonyms + query_hints',
            constraints: {
                max_expansions: 6,
                prefer_allowlist_site_hints: true,
            },
        },
        ranking: {
            tiers_weight: {
                T1: 1.0,
                T2: 0.85,
                T3: 0.45,
                T4: 0.2,
            },
            penalties: {
                negative_treatment: -0.5,
                pending_appeal: -0.3,
                political_risk_flag: -0.4,
            },
            hard_blocks: ['overruled', 'vacated'],
        },
        identifiers_normalization: ['ELI for legislation', 'ECLI for cases'],
        allowlist_domains: {
            france: ['legifrance.gouv.fr', 'courdecassation.fr', 'conseil-etat.fr'],
            belgium: ['justel.fgov.be', 'moniteur.be', 'ejustice.fgov.be'],
            luxembourg: ['legilux.public.lu'],
            switzerland: ['fedlex.admin.ch', 'bger.ch'],
            canada_qc: ['legisquebec.gouv.qc.ca', 'canlii.org', 'laws-lois.justice.gc.ca'],
            monaco: ['legimonaco.mc'],
            rwanda: ['minijust.gov.rw', 'rlrc.gov.rw', 'amategeko.gov.rw', 'judiciary.gov.rw', 'rwandalii.africanlii.org'],
            maghreb: {
                maroc: ['sgg.gov.ma'],
                tunisie: ['iort.gov.tn'],
                algerie: ['joradp.dz'],
            },
            ohada: ['ohada.org'],
            eu: ['eur-lex.europa.eu'],
            overlays: {
                oapi: ['oapi.int'],
                cima: ['cima-afrique.org'],
            },
        },
    },
    actions_catalog: {
        research: [
            'Answer legal question (IRAC/CREAC) with official citations',
            'Show opposing view / minority position',
            'Generate Bench memo (neutral) with options',
        ],
        drafting: [
            'Draft complaint/requête/assignation',
            'Draft defense/memoire en réponse',
            'Redline uploaded contract with rationale & sources',
            'Generate letters (mise en demeure, notice, settlement offer)',
        ],
        procedure: [
            'Compute deadlines & forclusion',
            'Service of process plan & proof templates',
            'Court fees estimator & forms checklist',
            'Bundle exhibits (pagination, TOC, bookmarks)',
        ],
        citations: [
            'Find official consolidated article',
            'Version diff & quote exact passage',
            'Cite-check all footnotes',
        ],
        enforcement: [
            'OHADA: Procédure simplifiée & voies d’exécution',
            'Seizure schedules & notices',
        ],
        compliance: ['GDPR/Privacy flags', 'CEPEJ/EU AI Act policy check'],
        evidence: ['OCR & normalize scans', 'Auto-tag evidence to issues/articles'],
        negotiation: ['Generate proposal & alternatives', 'Risk matrix & fallback positions'],
    },
    tools_registry: {
        hosted: ['web_search', 'file_search'],
        functions: [
            'routeJurisdiction(question) -> {country, eu, ohada, confidence}',
            'lookupCodeArticle(jurisdiction, code, article) -> {url, title, publisher, consolidation, effective_date}',
            'ohadaUniformAct(topic, subtopic?) -> {acte, articles[], dates, url}',
            'deadlineCalculator(jurisdiction, procedure_type, start_date, service_method?) -> {deadline_date, notes, risk_flags}',
            'limitationCheck(jurisdiction, claim_type, trigger_date, tolling?) -> {limit_years, deadline_date, notes}',
            'redlineContract(doc_id, jurisdiction) -> {diff, rationale[], citations[]}',
            'generateTemplate(jurisdiction, matter_type) -> {sections[], fill_ins[]}',
            'validateCitation(url) -> {allowlisted, domain, reason?}',
            'checkBindingLanguage(url, juris_code) -> {binding_lang, translation_notice?}',
            'snapshotAuthority(url) -> {storage_path, hash, doc_id}',
            'computeCaseScore(source_id) -> {score_overall, axes}',
            'buildTreatmentGraph(since?) -> {edges, updated_cases}',
            'interestCalculator(jurisdiction, principal, start_date, end_date, rate_type) -> {amount, method}',
            'court_fees(jurisdiction, action_type) -> {fee_table[], notes}',
            'service_of_process(jurisdiction, method, party_location) -> {steps[], proofs[], risks[]}',
            'hearing_schedule?(jurisdiction, court) -> {availability?, notes}',
            'exhibit_bundler(doc_ids[]) -> {bundle_pdf, index_json}',
            'document_parser(doc_id) -> {sections[], anchors[]}',
            'risk_assessor(context) -> {matrix, mitigations}',
        ],
    },
    playbooks: {
        civil_claim_fr: {
            steps: [
                { intake: ['Parties', 'Faits', 'Demandes', 'Compétence', 'Preuves'] },
                { legal_basis: ['Code civil art. 1240…', 'Textes spéciaux'] },
                { drafting: ['Assignation', 'Pièces', 'Conclusions'] },
                { service: ['Mode', 'Délais', 'Preuve de signification'] },
                { hearing: ['Calendrier', 'Conclusions finales'] },
                { judgment: ['Réception', 'Délais de recours'] },
                { enforcement: ['Titre exécutoire', 'Saisies', 'Mainlevée'] },
            ],
            agents: ['concierge', 'conseil_recherche', 'rédaction', 'procédure', 'evidence', 'calculs', 'case_score'],
            hitl_triggers: ['contentieux pénal', 'délais proches', 'montant élevé'],
            outputs: ['IRAC', 'Assignation PDF/DOCX', 'Tableau de preuves', 'Calendrier ICS', 'Bibliographie'],
        },
        ohada_debt_recovery: {
            steps: ['Demande', 'Titre', 'Injonction', 'Signification', 'Opposition/Recours', 'Exécution (saisies)'],
            agents: ['ohada', 'procédure', 'calculs', 'evidence'],
            outputs: ['Projet d’ordonnance', 'Modèles de saisie', 'Timeline'],
        },
        employment_dismissal: {
            steps: ['Intake', 'Base légale', 'Rupture', 'Indemnités', 'Contentieux'],
            agents: ['conseil_recherche', 'rédaction', 'calculs'],
        },
        company_formation_ohada: {
            steps: ['Type social', 'Statuts', 'Immatriculation', 'Registre', 'Publicité'],
            agents: ['ohada', 'rédaction'],
        },
        rwanda_example: {
            steps: ['Legal basis (EN/FR/RW)', 'Filing', 'Hearing', 'Judgment', 'Appeal'],
            agents: ['conseil_recherche', 'procédure', 'langue'],
        },
    },
    ui_ux: {
        surfaces: [
            {
                agent_desk: {
                    layout: 'Chat + Action Bar + Plan Drawer + Evidence Pane',
                    elements: {
                        action_bar: ['Ask', 'Do', 'Review', 'Generate'],
                        smart_stepper: 'Shows where you are in the process; next best actions',
                        plan_drawer: 'Agent plan & tools used (no chain-of-thought)',
                        tool_chips: 'Clickable chips for invoked tools; show status and results',
                        quick_actions: ['Compute deadline', 'Draft filing', 'Cite-check', 'Bundle exhibits'],
                        evidence_pane: 'Citations list with badges + version timeline',
                        case_score_badges: '0–100 with axis breakdown',
                        banners: ['Maghreb language', 'OHADA pre-emption', 'Staleness'],
                        hitl_cta: 'Prominent button; sticky on mobile',
                    },
                },
            },
            {
                process_navigator: {
                    purpose: 'Guided playbooks (step-by-step) with forms & checklists',
                    features: ['Slot-filling for missing facts', 'Auto-generate docs at each step', 'Court-specific notes'],
                },
            },
            {
                evidence_inbox: {
                    purpose: 'Drive/OCR intake & triage',
                    features: ['Dropzone', 'OCR status', 'Link to Matter', 'Add anchors to articles'],
                },
            },
            {
                drafting_studio: {
                    purpose: 'Live redline & template composer',
                    features: ['Accept/Reject with rationale', 'Clause benchmarks', 'Explain with statutes'],
                },
            },
            {
                citations_browser: {
                    purpose: 'Authority view',
                    features: ['Search official only', 'Article anchors', 'Version diff', 'OHADA tab'],
                },
            },
            {
                admin_console: {
                    purpose: 'People, policies, entitlements, Drive link status',
                },
            },
        ],
        pwa_mobile: {
            bottom_nav: ['Home', 'Research', 'Draft', 'Queue'],
            offline: ['Outbox', 'Stale snapshot warning + Verify now'],
            camera_ocr: true,
            voice_input: true,
            confidential_mode_controls: ['Disable web search', 'Blur previews', 'No local cache'],
        },
        motion_and_style: {
            style: 'Liquid-glass cards, vibrant gradients, soft depth',
            transitions: 'Framer Motion 150–200ms, respect prefers-reduced-motion',
            accessibility: 'WCAG 2.2 AA, tap targets ≥44px, screen reader landmarks',
        },
    },
    drive_integration: {
        model: 'Service Account with access to ONE shared drive/folder',
        root_folder: 'Legal Authorities – Francophone',
        watchers: ['changes.watch + webhook', 'cron renewals'],
        ingestion: ['validate_manifest', 'normalize/OCR', 'summarize', 'chunk_embed', 'vector_upload', 'supabase_mirror'],
        quarantine_rules: ['non-allowlisted', 'missing dates', 'translation_without_binding'],
    },
    agent_learning: {
        loop: ['collect_signals', 'diagnose', 'apply', 'evaluate', 'gate'],
        targets: ['retrieval synonyms/hints', 'jurisdiction routing', 'guardrails', 'citation canonicalization', 'case scoring'],
        metrics_thresholds: {
            citations_allowlisted_p95: 0.95,
            temporal_validity_p95: 0.95,
            maghreb_banner_coverage: 1.0,
            hitl_recall_high_risk: 0.98,
        },
        case_scoring_axes: ['PW', 'ST', 'SA', 'PI', 'JF', 'LB', 'RC', 'CQ'],
        case_scoring_profiles: {
            civil_law_default: { PW: 0.18, ST: 0.18, SA: 0.3, PI: 0.08, JF: 0.1, LB: 0.06, RC: 0.05, CQ: 0.05 },
            ohada: { PW: 0.2, ST: 0.18, SA: 0.32, PI: 0.07, JF: 0.1, LB: 0.05, RC: 0.04, CQ: 0.04 },
        },
    },
    data_model_brief: {
        key_tables: [
            'organizations',
            'org_members',
            'profiles',
            'org_policies',
            'jurisdiction_entitlements',
            'sources',
            'documents',
            'document_chunks',
            'agent_runs',
            'tool_invocations',
            'run_citations',
            'hitl_queue',
            'case_scores',
            'case_treatments',
            'case_statute_links',
            'audit_events',
            'consent_events',
        ],
        rls_helper: 'public.is_org_member(org_id)',
        audit_events: ['role_change', 'policy_toggle', 'allowlist_toggle', 'drive_ingest', 'hitl_decision', 'export', 'deletion'],
        consent: ['ToS', 'Privacy', 'AI-assist disclosure'],
    },
    acceptance: {
        interactive_agent_experience: [
            'Every screen has Ask/Do/Review/Generate modes and shows the Agent Plan.',
            'Process Navigator playbooks exist for civil claim (FR), OHADA debt recovery, employment dismissal, OHADA company formation, one Rwanda flow.',
            'Quick Actions perform tool-backed steps (deadline, filing draft, cite-check, bundle exhibits).',
        ],
        trust_and_sources: [
            'Citations show badges (Officiel/Consolidé/Traduction/Jurisprudence), with ELI/ECLI where available.',
            'Maghreb/Canada/Rwanda language affordances appear in-context.',
            'Case score badges displayed with axis rationale.',
        ],
        mobile_pwa: ['Installable; offline Outbox; camera OCR; voice input; sticky HITL CTA.'],
        governance: [
            'France judge-analytics blocked server- & UI-side.',
            'OHADA pre-emption banners when applicable; statute-first enforced.',
        ],
        drive_link: ['Backfill + delta sync working; quarantine pipeline and Admin status page online.'],
    },
};
export function getAutonomousSuiteManifest() {
    return AUTONOMOUS_JUSTICE_SUITE;
}
export function getAgentDefinition(code) {
    const agent = AUTONOMOUS_JUSTICE_SUITE.agents[code];
    if (!agent) {
        throw new Error(`Unknown autonomous agent: ${code}`);
    }
    return agent;
}
export function listAgentCodes() {
    return Object.keys(AUTONOMOUS_JUSTICE_SUITE.agents);
}
export function listUserTypes() {
    return AUTONOMOUS_JUSTICE_SUITE.users.user_types;
}
export function getUserType(code) {
    const entry = AUTONOMOUS_JUSTICE_SUITE.users.user_types.find((type) => type.code === code);
    if (!entry) {
        throw new Error(`Unknown autonomous user type: ${code}`);
    }
    return entry;
}
export function getComplianceGates() {
    return AUTONOMOUS_JUSTICE_SUITE.autonomous_legal_agent_suite.compliance_hard_gates;
}
export function getPermissionsMatrix() {
    return AUTONOMOUS_JUSTICE_SUITE.users.permissions_matrix;
}
