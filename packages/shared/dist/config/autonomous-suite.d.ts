export declare const AUTONOMOUS_JUSTICE_SUITE: {
    readonly autonomous_legal_agent_suite: {
        readonly name: "Avocat-AI Francophone — Autonomous Justice Suite";
        readonly vision: "A living, interactive, personal legal assistant that behaves like a seasoned avocat/juriste/greffier/procureur—guiding users through every legal & court process with actionable steps, trusted sources, and agentic tools.";
        readonly default_language: "fr";
        readonly supported_languages: readonly ["fr", "en", "rw"];
        readonly jurisdictions_core: readonly ["FR", "BE", "LU", "CH-FR", "CA-QC", "MC", "OHADA", "MA", "TN", "DZ", "RW", "EU"];
        readonly overlays: readonly ["OAPI", "CIMA"];
        readonly compliance_hard_gates: {
            readonly france_judge_analytics_block: true;
            readonly statute_first: true;
            readonly cite_or_refuse: true;
            readonly ohada_preemption_priority: true;
            readonly maghreb_binding_banner: true;
            readonly confidential_mode: {
                readonly enforced_when: readonly ["org_policy.confidential_mode = true"];
            };
        };
    };
    readonly users: {
        readonly roles: readonly ["owner", "admin", "member", "reviewer", "viewer", "compliance_officer", "auditor"];
        readonly user_types: readonly [{
            readonly code: "avocat_externe";
            readonly label: "Avocat/Attorney (cabinet)";
            readonly default_role: "member";
            readonly features: readonly ["Research", "Drafting", "Matters", "Deadlines", "Citations", "HITL submit"];
        }, {
            readonly code: "juriste_entreprise";
            readonly label: "Juriste d’entreprise (in-house)";
            readonly default_role: "member";
            readonly features: readonly ["Research", "Drafting", "Benchmarks", "Policies", "Matters"];
        }, {
            readonly code: "greffier";
            readonly label: "Greffier/Clerk";
            readonly default_role: "viewer";
            readonly features: readonly ["Citations", "Authority Browser", "Print/Export"];
        }, {
            readonly code: "magistrat_assistant";
            readonly label: "Assistant de juge (Bench support)";
            readonly default_role: "viewer";
            readonly features: readonly ["Bench memo agent", "Citations", "Authority Browser"];
        }, {
            readonly code: "ministere_public";
            readonly label: "Procureur/Ministère public";
            readonly default_role: "member";
            readonly features: readonly ["Procedural Navigator", "Drafting (réquisitions)", "Deadlines", "Evidence tools"];
        }, {
            readonly code: "paralegal";
            readonly label: "Paralegal/Assistant";
            readonly default_role: "member";
            readonly features: readonly ["Templates", "Doc assembly", "Timeline", "Filing packets"];
        }, {
            readonly code: "citizen_tier";
            readonly label: "Citoyen/Assistance";
            readonly default_role: "viewer";
            readonly features: readonly ["Guided Q&A", "Simple documents", "Referrals", "Disclaimers strong"];
        }];
        readonly abac_attributes: readonly ["jurisdiction_entitlements", "confidential_mode", "sensitive_topic_hitl", "residency_zone"];
        readonly permissions_matrix: {
            readonly 'research.run': readonly ["member", "reviewer", "admin", "owner"];
            readonly 'drafting.edit': readonly ["member", "reviewer", "admin", "owner"];
            readonly 'hitl.review': readonly ["reviewer", "admin", "owner"];
            readonly 'corpus.manage': readonly ["admin", "owner"];
            readonly 'policies.manage': readonly ["admin", "owner", "compliance_officer"];
            readonly 'billing.manage': readonly ["owner"];
            readonly 'audit.read': readonly ["auditor", "compliance_officer", "admin", "owner"];
            readonly 'allowlist.toggle': readonly ["admin", "owner"];
            readonly 'residency.change': readonly ["owner"];
            readonly 'people.manage': readonly ["admin", "owner"];
            readonly 'data.export_delete': readonly ["owner"];
        };
    };
    readonly agents: {
        readonly orchestrator: {
            readonly code: "concierge";
            readonly label: "Concierge Agent (Chef d’orchestre)";
            readonly mission: "Understands intent, routes to specialist agents, composes plan, supervises tools.";
            readonly key_capabilities: readonly ["intent_detection", "jurisdiction_routing", "plan_generation", "tool_budgeting", "HITL_triggering"];
        };
        readonly counsel_research: {
            readonly code: "conseil_recherche";
            readonly label: "Conseil Recherche (droit civil)";
            readonly mission: "IRAC/CREAC answers, statute-first, case synthesis with reliability scoring.";
            readonly tools: readonly ["file_search", "web_search", "lookupCodeArticle", "ohadaUniformAct", "validateCitation"];
        };
        readonly ohada_counsel: {
            readonly code: "ohada";
            readonly label: "Conseil OHADA";
            readonly mission: "Uniform Acts + CCJA first, pre-emption banners, registry & formalities.";
            readonly tools: readonly ["ohadaUniformAct", "validateCitation", "deadlineCalculator"];
        };
        readonly eu_overlay: {
            readonly code: "ue_overlay";
            readonly label: "Conseil UE/EUR-Lex";
            readonly mission: "Map directives/regulations; ELI/ECLI normalized; supremacy/conflict notes.";
            readonly tools: readonly ["validateCitation"];
        };
        readonly drafting_studio: {
            readonly code: "rédaction";
            readonly label: "Rédaction & Redline";
            readonly mission: "Generate, redline, and benchmark clauses with legal rationale & citations.";
            readonly tools: readonly ["redlineContract", "generateTemplate", "validateCitation"];
        };
        readonly procedural_navigator: {
            readonly code: "procédure";
            readonly label: "Navigateur de procédure";
            readonly mission: "Guided stepper for filings/service/fees/hearings/enforcement per jurisdiction.";
            readonly tools: readonly ["deadlineCalculator", "limitationCheck", "court_fees", "service_of_process", "hearing_schedule?"];
        };
        readonly bench_memo: {
            readonly code: "bench";
            readonly label: "Bench-Memo (Support magistrat)";
            readonly mission: "Neutral bench memos; options; issue framing; no judge analytics.";
            readonly tools: readonly ["file_search", "validateCitation"];
        };
        readonly evidence_discovery: {
            readonly code: "evidence";
            readonly label: "Preuve & Discovery";
            readonly mission: "Evidence intake (Drive/OCR), exhibit bundling, cite-check.";
            readonly tools: readonly ["snapshotAuthority", "document_parser", "exhibit_bundler"];
        };
        readonly case_analyst: {
            readonly code: "case_score";
            readonly label: "Analyste jurisprudence";
            readonly mission: "Compute case quality (PW/ST/SA/PI/JF/LB/RC/CQ) with rationale and treatment graph.";
            readonly tools: readonly ["computeCaseScore", "buildTreatmentGraph"];
        };
        readonly deadlines_finance: {
            readonly code: "calculs";
            readonly label: "Délais, intérêts & dommages";
            readonly mission: "Compute deadlines, interests, damages per statute/regulation.";
            readonly tools: readonly ["deadlineCalculator", "interestCalculator"];
        };
        readonly language_binding: {
            readonly code: "langue";
            readonly label: "Langue & Traductions";
            readonly mission: "Maghreb/Rwanda triage; warn if FR is non-binding; link Arabic/Kinyarwanda/EN.";
            readonly tools: readonly ["checkBindingLanguage"];
        };
        readonly librarian: {
            readonly code: "bibliothécaire";
            readonly label: "Bibliothécaire (Corpus Drive)";
            readonly mission: "Ingest/normalize/summarize legal docs from the secure Drive folder; maintain metadata.";
            readonly tools: readonly ["gdrive_watcher", "normalize", "summarize", "embed", "vector_upload"];
        };
        readonly negotiation_mediator: {
            readonly code: "negociation";
            readonly label: "Négociation/Médiation";
            readonly mission: "Generate proposals, compare concessions, track risks & fallback positions.";
            readonly tools: readonly ["generateTemplate", "risk_assessor"];
        };
    };
    readonly agent_settings_schema: {
        readonly common: {
            readonly language_default: {
                readonly type: "enum";
                readonly values: readonly ["fr", "en", "rw"];
                readonly default: "fr";
            };
            readonly jurisdictions_default: {
                readonly type: "array";
                readonly values: "jurisdiction codes";
            };
            readonly citation_density: {
                readonly type: "enum";
                readonly values: readonly ["low", "medium", "high"];
                readonly default: "high";
            };
            readonly risk_threshold: {
                readonly type: "enum";
                readonly values: readonly ["LOW", "MEDIUM", "HIGH"];
                readonly default: "MEDIUM";
            };
            readonly hitl_on_high_risk: {
                readonly type: "boolean";
                readonly default: true;
            };
            readonly allow_tools: {
                readonly type: "array";
                readonly values: "tool codes";
            };
            readonly time_budget_seconds: {
                readonly type: "int";
                readonly default: 45;
            };
            readonly result_style: {
                readonly type: "enum";
                readonly values: readonly ["IRAC", "CREAC", "Memo", "Brief"];
                readonly default: "IRAC";
            };
        };
        readonly per_agent_overrides: {
            readonly concierge: {
                readonly plan_visibility: {
                    readonly type: "boolean";
                    readonly default: true;
                };
            };
            readonly conseil_recherche: {
                readonly opposing_view: {
                    readonly type: "boolean";
                    readonly default: true;
                };
            };
            readonly ohada: {
                readonly preemption_banner: {
                    readonly type: "boolean";
                    readonly default: true;
                };
            };
            readonly procédure: {
                readonly deadline_display: {
                    readonly type: "enum";
                    readonly values: readonly ["calendar_days", "court_days"];
                };
            };
            readonly bench: {
                readonly neutrality_mode: {
                    readonly type: "boolean";
                    readonly default: true;
                };
            };
        };
    };
    readonly search: {
        readonly modes: readonly ["semantic", "keyword", "hybrid"];
        readonly vector: {
            readonly store: "OpenAI Vector Store + Supabase pgvector mirror";
            readonly embedding_model: "text-embedding-3-large";
            readonly chunking: {
                readonly statutes: {
                    readonly by: "article";
                    readonly max_tokens: 1000;
                    readonly overlap: 120;
                };
                readonly cases: {
                    readonly by: "paragraph";
                    readonly max_tokens: 1200;
                    readonly overlap: 150;
                };
                readonly gazettes: {
                    readonly by: "item";
                    readonly max_tokens: 1000;
                    readonly overlap: 120;
                };
            };
        };
        readonly query_rewriting: {
            readonly synonyms_source: "agent_synonyms + query_hints";
            readonly constraints: {
                readonly max_expansions: 6;
                readonly prefer_allowlist_site_hints: true;
            };
        };
        readonly ranking: {
            readonly tiers_weight: {
                readonly T1: 1;
                readonly T2: 0.85;
                readonly T3: 0.45;
                readonly T4: 0.2;
            };
            readonly penalties: {
                readonly negative_treatment: -0.5;
                readonly pending_appeal: -0.3;
                readonly political_risk_flag: -0.4;
            };
            readonly hard_blocks: readonly ["overruled", "vacated"];
        };
        readonly identifiers_normalization: readonly ["ELI for legislation", "ECLI for cases"];
        readonly allowlist_domains: {
            readonly france: readonly ["legifrance.gouv.fr", "courdecassation.fr", "conseil-etat.fr"];
            readonly belgium: readonly ["justel.fgov.be", "moniteur.be", "ejustice.fgov.be"];
            readonly luxembourg: readonly ["legilux.public.lu"];
            readonly switzerland: readonly ["fedlex.admin.ch", "bger.ch"];
            readonly canada_qc: readonly ["legisquebec.gouv.qc.ca", "canlii.org", "laws-lois.justice.gc.ca"];
            readonly monaco: readonly ["legimonaco.mc"];
            readonly rwanda: readonly ["minijust.gov.rw", "rlrc.gov.rw", "amategeko.gov.rw", "judiciary.gov.rw", "rwandalii.africanlii.org"];
            readonly maghreb: {
                readonly maroc: readonly ["sgg.gov.ma"];
                readonly tunisie: readonly ["iort.gov.tn"];
                readonly algerie: readonly ["joradp.dz"];
            };
            readonly ohada: readonly ["ohada.org"];
            readonly eu: readonly ["eur-lex.europa.eu"];
            readonly overlays: {
                readonly oapi: readonly ["oapi.int"];
                readonly cima: readonly ["cima-afrique.org"];
            };
        };
    };
    readonly actions_catalog: {
        readonly research: readonly ["Answer legal question (IRAC/CREAC) with official citations", "Show opposing view / minority position", "Generate Bench memo (neutral) with options"];
        readonly drafting: readonly ["Draft complaint/requête/assignation", "Draft defense/memoire en réponse", "Redline uploaded contract with rationale & sources", "Generate letters (mise en demeure, notice, settlement offer)"];
        readonly procedure: readonly ["Compute deadlines & forclusion", "Service of process plan & proof templates", "Court fees estimator & forms checklist", "Bundle exhibits (pagination, TOC, bookmarks)"];
        readonly citations: readonly ["Find official consolidated article", "Version diff & quote exact passage", "Cite-check all footnotes"];
        readonly enforcement: readonly ["OHADA: Procédure simplifiée & voies d’exécution", "Seizure schedules & notices"];
        readonly compliance: readonly ["GDPR/Privacy flags", "CEPEJ/EU AI Act policy check"];
        readonly evidence: readonly ["OCR & normalize scans", "Auto-tag evidence to issues/articles"];
        readonly negotiation: readonly ["Generate proposal & alternatives", "Risk matrix & fallback positions"];
    };
    readonly tools_registry: {
        readonly hosted: readonly ["web_search", "file_search"];
        readonly functions: readonly ["routeJurisdiction(question) -> {country, eu, ohada, confidence}", "lookupCodeArticle(jurisdiction, code, article) -> {url, title, publisher, consolidation, effective_date}", "ohadaUniformAct(topic, subtopic?) -> {acte, articles[], dates, url}", "deadlineCalculator(jurisdiction, procedure_type, start_date, service_method?) -> {deadline_date, notes, risk_flags}", "limitationCheck(jurisdiction, claim_type, trigger_date, tolling?) -> {limit_years, deadline_date, notes}", "redlineContract(doc_id, jurisdiction) -> {diff, rationale[], citations[]}", "generateTemplate(jurisdiction, matter_type) -> {sections[], fill_ins[]}", "validateCitation(url) -> {allowlisted, domain, reason?}", "checkBindingLanguage(url, juris_code) -> {binding_lang, translation_notice?}", "snapshotAuthority(url) -> {storage_path, hash, doc_id}", "computeCaseScore(source_id) -> {score_overall, axes}", "buildTreatmentGraph(since?) -> {edges, updated_cases}", "interestCalculator(jurisdiction, principal, start_date, end_date, rate_type) -> {amount, method}", "court_fees(jurisdiction, action_type) -> {fee_table[], notes}", "service_of_process(jurisdiction, method, party_location) -> {steps[], proofs[], risks[]}", "hearing_schedule?(jurisdiction, court) -> {availability?, notes}", "exhibit_bundler(doc_ids[]) -> {bundle_pdf, index_json}", "document_parser(doc_id) -> {sections[], anchors[]}", "risk_assessor(context) -> {matrix, mitigations}"];
    };
    readonly playbooks: {
        readonly civil_claim_fr: {
            readonly steps: readonly [{
                readonly intake: readonly ["Parties", "Faits", "Demandes", "Compétence", "Preuves"];
            }, {
                readonly legal_basis: readonly ["Code civil art. 1240…", "Textes spéciaux"];
            }, {
                readonly drafting: readonly ["Assignation", "Pièces", "Conclusions"];
            }, {
                readonly service: readonly ["Mode", "Délais", "Preuve de signification"];
            }, {
                readonly hearing: readonly ["Calendrier", "Conclusions finales"];
            }, {
                readonly judgment: readonly ["Réception", "Délais de recours"];
            }, {
                readonly enforcement: readonly ["Titre exécutoire", "Saisies", "Mainlevée"];
            }];
            readonly agents: readonly ["concierge", "conseil_recherche", "rédaction", "procédure", "evidence", "calculs", "case_score"];
            readonly hitl_triggers: readonly ["contentieux pénal", "délais proches", "montant élevé"];
            readonly outputs: readonly ["IRAC", "Assignation PDF/DOCX", "Tableau de preuves", "Calendrier ICS", "Bibliographie"];
        };
        readonly ohada_debt_recovery: {
            readonly steps: readonly ["Demande", "Titre", "Injonction", "Signification", "Opposition/Recours", "Exécution (saisies)"];
            readonly agents: readonly ["ohada", "procédure", "calculs", "evidence"];
            readonly outputs: readonly ["Projet d’ordonnance", "Modèles de saisie", "Timeline"];
        };
        readonly employment_dismissal: {
            readonly steps: readonly ["Intake", "Base légale", "Rupture", "Indemnités", "Contentieux"];
            readonly agents: readonly ["conseil_recherche", "rédaction", "calculs"];
        };
        readonly company_formation_ohada: {
            readonly steps: readonly ["Type social", "Statuts", "Immatriculation", "Registre", "Publicité"];
            readonly agents: readonly ["ohada", "rédaction"];
        };
        readonly rwanda_example: {
            readonly steps: readonly ["Legal basis (EN/FR/RW)", "Filing", "Hearing", "Judgment", "Appeal"];
            readonly agents: readonly ["conseil_recherche", "procédure", "langue"];
        };
    };
    readonly ui_ux: {
        readonly surfaces: readonly [{
            readonly agent_desk: {
                readonly layout: "Chat + Action Bar + Plan Drawer + Evidence Pane";
                readonly elements: {
                    readonly action_bar: readonly ["Ask", "Do", "Review", "Generate"];
                    readonly smart_stepper: "Shows where you are in the process; next best actions";
                    readonly plan_drawer: "Agent plan & tools used (no chain-of-thought)";
                    readonly tool_chips: "Clickable chips for invoked tools; show status and results";
                    readonly quick_actions: readonly ["Compute deadline", "Draft filing", "Cite-check", "Bundle exhibits"];
                    readonly evidence_pane: "Citations list with badges + version timeline";
                    readonly case_score_badges: "0–100 with axis breakdown";
                    readonly banners: readonly ["Maghreb language", "OHADA pre-emption", "Staleness"];
                    readonly hitl_cta: "Prominent button; sticky on mobile";
                };
            };
        }, {
            readonly process_navigator: {
                readonly purpose: "Guided playbooks (step-by-step) with forms & checklists";
                readonly features: readonly ["Slot-filling for missing facts", "Auto-generate docs at each step", "Court-specific notes"];
            };
        }, {
            readonly evidence_inbox: {
                readonly purpose: "Drive/OCR intake & triage";
                readonly features: readonly ["Dropzone", "OCR status", "Link to Matter", "Add anchors to articles"];
            };
        }, {
            readonly drafting_studio: {
                readonly purpose: "Live redline & template composer";
                readonly features: readonly ["Accept/Reject with rationale", "Clause benchmarks", "Explain with statutes"];
            };
        }, {
            readonly citations_browser: {
                readonly purpose: "Authority view";
                readonly features: readonly ["Search official only", "Article anchors", "Version diff", "OHADA tab"];
            };
        }, {
            readonly admin_console: {
                readonly purpose: "People, policies, entitlements, Drive link status";
            };
        }];
        readonly pwa_mobile: {
            readonly bottom_nav: readonly ["Home", "Research", "Draft", "Queue"];
            readonly offline: readonly ["Outbox", "Stale snapshot warning + Verify now"];
            readonly camera_ocr: true;
            readonly voice_input: true;
            readonly confidential_mode_controls: readonly ["Disable web search", "Blur previews", "No local cache"];
        };
        readonly motion_and_style: {
            readonly style: "Liquid-glass cards, vibrant gradients, soft depth";
            readonly transitions: "Framer Motion 150–200ms, respect prefers-reduced-motion";
            readonly accessibility: "WCAG 2.2 AA, tap targets ≥44px, screen reader landmarks";
        };
    };
    readonly drive_integration: {
        readonly model: "Service Account with access to ONE shared drive/folder";
        readonly root_folder: "Legal Authorities – Francophone";
        readonly watchers: readonly ["changes.watch + webhook", "cron renewals"];
        readonly ingestion: readonly ["validate_manifest", "normalize/OCR", "summarize", "chunk_embed", "vector_upload", "supabase_mirror"];
        readonly quarantine_rules: readonly ["non-allowlisted", "missing dates", "translation_without_binding"];
    };
    readonly agent_learning: {
        readonly loop: readonly ["collect_signals", "diagnose", "apply", "evaluate", "gate"];
        readonly targets: readonly ["retrieval synonyms/hints", "jurisdiction routing", "guardrails", "citation canonicalization", "case scoring"];
        readonly metrics_thresholds: {
            readonly citations_allowlisted_p95: 0.95;
            readonly temporal_validity_p95: 0.95;
            readonly maghreb_banner_coverage: 1;
            readonly hitl_recall_high_risk: 0.98;
        };
        readonly case_scoring_axes: readonly ["PW", "ST", "SA", "PI", "JF", "LB", "RC", "CQ"];
        readonly case_scoring_profiles: {
            readonly civil_law_default: {
                readonly PW: 0.18;
                readonly ST: 0.18;
                readonly SA: 0.3;
                readonly PI: 0.08;
                readonly JF: 0.1;
                readonly LB: 0.06;
                readonly RC: 0.05;
                readonly CQ: 0.05;
            };
            readonly ohada: {
                readonly PW: 0.2;
                readonly ST: 0.18;
                readonly SA: 0.32;
                readonly PI: 0.07;
                readonly JF: 0.1;
                readonly LB: 0.05;
                readonly RC: 0.04;
                readonly CQ: 0.04;
            };
        };
    };
    readonly data_model_brief: {
        readonly key_tables: readonly ["organizations", "org_members", "profiles", "org_policies", "jurisdiction_entitlements", "sources", "documents", "document_chunks", "agent_runs", "tool_invocations", "run_citations", "hitl_queue", "case_scores", "case_treatments", "case_statute_links", "audit_events", "consent_events"];
        readonly rls_helper: "public.is_org_member(org_id)";
        readonly audit_events: readonly ["role_change", "policy_toggle", "allowlist_toggle", "drive_ingest", "hitl_decision", "export", "deletion"];
        readonly consent: readonly ["ToS", "Privacy", "AI-assist disclosure"];
    };
    readonly acceptance: {
        readonly interactive_agent_experience: readonly ["Every screen has Ask/Do/Review/Generate modes and shows the Agent Plan.", "Process Navigator playbooks exist for civil claim (FR), OHADA debt recovery, employment dismissal, OHADA company formation, one Rwanda flow.", "Quick Actions perform tool-backed steps (deadline, filing draft, cite-check, bundle exhibits)."];
        readonly trust_and_sources: readonly ["Citations show badges (Officiel/Consolidé/Traduction/Jurisprudence), with ELI/ECLI where available.", "Maghreb/Canada/Rwanda language affordances appear in-context.", "Case score badges displayed with axis rationale."];
        readonly mobile_pwa: readonly ["Installable; offline Outbox; camera OCR; voice input; sticky HITL CTA."];
        readonly governance: readonly ["France judge-analytics blocked server- & UI-side.", "OHADA pre-emption banners when applicable; statute-first enforced."];
        readonly drive_link: readonly ["Backfill + delta sync working; quarantine pipeline and Admin status page online."];
    };
};
export type AutonomousJusticeSuiteManifest = typeof AUTONOMOUS_JUSTICE_SUITE;
export type AutonomousAgentCode = keyof AutonomousJusticeSuiteManifest['agents'];
export type AutonomousUserType = AutonomousJusticeSuiteManifest['users']['user_types'][number]['code'];
export declare function getAutonomousSuiteManifest(): AutonomousJusticeSuiteManifest;
export declare function getAgentDefinition<C extends AutonomousAgentCode>(code: C): AutonomousJusticeSuiteManifest['agents'][C];
export declare function listAgentCodes(): AutonomousAgentCode[];
export declare function listUserTypes(): readonly [{
    readonly code: "avocat_externe";
    readonly label: "Avocat/Attorney (cabinet)";
    readonly default_role: "member";
    readonly features: readonly ["Research", "Drafting", "Matters", "Deadlines", "Citations", "HITL submit"];
}, {
    readonly code: "juriste_entreprise";
    readonly label: "Juriste d’entreprise (in-house)";
    readonly default_role: "member";
    readonly features: readonly ["Research", "Drafting", "Benchmarks", "Policies", "Matters"];
}, {
    readonly code: "greffier";
    readonly label: "Greffier/Clerk";
    readonly default_role: "viewer";
    readonly features: readonly ["Citations", "Authority Browser", "Print/Export"];
}, {
    readonly code: "magistrat_assistant";
    readonly label: "Assistant de juge (Bench support)";
    readonly default_role: "viewer";
    readonly features: readonly ["Bench memo agent", "Citations", "Authority Browser"];
}, {
    readonly code: "ministere_public";
    readonly label: "Procureur/Ministère public";
    readonly default_role: "member";
    readonly features: readonly ["Procedural Navigator", "Drafting (réquisitions)", "Deadlines", "Evidence tools"];
}, {
    readonly code: "paralegal";
    readonly label: "Paralegal/Assistant";
    readonly default_role: "member";
    readonly features: readonly ["Templates", "Doc assembly", "Timeline", "Filing packets"];
}, {
    readonly code: "citizen_tier";
    readonly label: "Citoyen/Assistance";
    readonly default_role: "viewer";
    readonly features: readonly ["Guided Q&A", "Simple documents", "Referrals", "Disclaimers strong"];
}];
export declare function getUserType(code: AutonomousUserType): {
    readonly code: "avocat_externe";
    readonly label: "Avocat/Attorney (cabinet)";
    readonly default_role: "member";
    readonly features: readonly ["Research", "Drafting", "Matters", "Deadlines", "Citations", "HITL submit"];
} | {
    readonly code: "juriste_entreprise";
    readonly label: "Juriste d’entreprise (in-house)";
    readonly default_role: "member";
    readonly features: readonly ["Research", "Drafting", "Benchmarks", "Policies", "Matters"];
} | {
    readonly code: "greffier";
    readonly label: "Greffier/Clerk";
    readonly default_role: "viewer";
    readonly features: readonly ["Citations", "Authority Browser", "Print/Export"];
} | {
    readonly code: "magistrat_assistant";
    readonly label: "Assistant de juge (Bench support)";
    readonly default_role: "viewer";
    readonly features: readonly ["Bench memo agent", "Citations", "Authority Browser"];
} | {
    readonly code: "ministere_public";
    readonly label: "Procureur/Ministère public";
    readonly default_role: "member";
    readonly features: readonly ["Procedural Navigator", "Drafting (réquisitions)", "Deadlines", "Evidence tools"];
} | {
    readonly code: "paralegal";
    readonly label: "Paralegal/Assistant";
    readonly default_role: "member";
    readonly features: readonly ["Templates", "Doc assembly", "Timeline", "Filing packets"];
} | {
    readonly code: "citizen_tier";
    readonly label: "Citoyen/Assistance";
    readonly default_role: "viewer";
    readonly features: readonly ["Guided Q&A", "Simple documents", "Referrals", "Disclaimers strong"];
};
export declare function getComplianceGates(): {
    readonly france_judge_analytics_block: true;
    readonly statute_first: true;
    readonly cite_or_refuse: true;
    readonly ohada_preemption_priority: true;
    readonly maghreb_binding_banner: true;
    readonly confidential_mode: {
        readonly enforced_when: readonly ["org_policy.confidential_mode = true"];
    };
};
export declare function getPermissionsMatrix(): {
    readonly 'research.run': readonly ["member", "reviewer", "admin", "owner"];
    readonly 'drafting.edit': readonly ["member", "reviewer", "admin", "owner"];
    readonly 'hitl.review': readonly ["reviewer", "admin", "owner"];
    readonly 'corpus.manage': readonly ["admin", "owner"];
    readonly 'policies.manage': readonly ["admin", "owner", "compliance_officer"];
    readonly 'billing.manage': readonly ["owner"];
    readonly 'audit.read': readonly ["auditor", "compliance_officer", "admin", "owner"];
    readonly 'allowlist.toggle': readonly ["admin", "owner"];
    readonly 'residency.change': readonly ["owner"];
    readonly 'people.manage': readonly ["admin", "owner"];
    readonly 'data.export_delete': readonly ["owner"];
};
//# sourceMappingURL=autonomous-suite.d.ts.map