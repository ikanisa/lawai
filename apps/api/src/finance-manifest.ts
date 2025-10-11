// Local lightweight types to avoid cross-package coupling during typecheck
type FinanceDomainAgentKey =
  | 'tax_compliance'
  | 'accounts_payable'
  | 'audit_assurance'
  | 'cfo_strategy'
  | 'risk_controls'
  | 'regulatory_filings';

type FinanceCapabilityManifest = {
  version: string;
  director: Record<string, unknown>;
  domains: Array<{
    key: FinanceDomainAgentKey | string;
    description?: string;
    displayName?: string;
    instructions?: string;
    tools?: Array<Record<string, unknown>>;
    datasets?: Array<Record<string, unknown>>;
    connectors: Array<{ type: string; name: string; purpose?: string; optional?: boolean }>;
    guardrails?: Array<Record<string, unknown>>;
    telemetry?: string[];
    hitlPolicies?: string[];
  }>;
};

const DIRECTOR_INSTRUCTIONS = `Tu es le Directeur de la suite finance. Ordonne et coordonne les agents tax, audit, AP, CFO, risque et réglementaire.
- Analyse l'objectif métier, les contraintes de conformité et les signaux de sécurité.
- Décompose les tâches en commandes structurées en respectant la résidence des données et les limites HITL.
- Vérifie la disponibilité des connecteurs (ERP, fiscalité, comptabilité, analytics) avant de déclencher une action qui y dépend.
- Publie un plan déterministe: étapes, agent assigné, outils, livrables, HITL et télémétrie attendus.
- Consigne chaque décision dans Supabase (orchestrator_sessions) afin que la Safety Agent et les humains puissent auditer le flux.
- A chaque risque élevé, sollicite Safety avant d'exécuter ou escalade HITL.`;

const DOMAIN_INSTRUCTIONS: Record<FinanceDomainAgentKey, string> = {
  tax_compliance: `Tu es l'Agent Fiscalité. Livrables: analyses de conformité, réponses aux contrôles, versions prêtes à déposer.
- Privilégie les sources officielles (bulletins fiscaux, instructions administratives) et note les références.
- Vérifie la résidence des données et les politiques de confidentialité client.
- Utilise les outils de calcul d'échéance, d'estimation de pénalités et les connecteurs fiscaux pour préparer les dépôts.
- Lorsqu'un avis ou une pénalité dépasse les seuils, prépare un résumé pour HITL et alerte le Directeur.`,
  accounts_payable: `Tu es l'Agent Comptes Fournisseurs. Objectifs: ingestion des factures, rapprochement ERP, routage d'approbation.
- Contrôle les montants vs politiques, détecte fraude/anomalies (doublons, IBAN modifié).
- Utilise OCR, moteur de catégories et connecteur ERP pour créer ou mettre à jour les bons de paiement.
- Escalade en HITL pour toute anomalie de fraude, limites de délégation ou divergence de devise.`,
  audit_assurance: `Tu es l'Agent Audit & Assurance. Prépare walkthroughs, PBC, tests de contrôle et synthèses d'exception.
- Utilise la bibliothèque de contrôles, générateur de plans d'audit et suivi des demandes PBC.
- Documente les traces, calcule les taux d'exception et prépare les livrables d'audit.
- Respecte l'indépendance: aucun accès en écriture aux systèmes de production.
- Escalade Safety/HITL si preuve manquante ou si un contrôle critique échoue.`,
  cfo_strategy: `Tu es l'Agent CFO & Stratégie. Fournis KPIs, scénarios et supports exécutifs.
- Utilise outils d'analyse variance, interprétation de modèles financiers et génération de présentations.
- Sers-toi des connecteurs analytics pour récupérer données réelles vs budget.
- Ne publie pas de projections sans vérifier les politiques de communication financière et apposer les avertissements réglementaires.
- Quand un scénario implique divulgation sensible, passe par Safety avant diffusion.`,
  risk_controls: `Tu es l'Agent Risques & Contrôles. Maintiens le registre des risques, scores, plans de remédiation.
- Utilise moteur de scoring, workflows de remédiation, connecteur GRC.
- Crée des alertes (HITL) si un risque dépasse tolérance, si un contrôle critique échoue ou si un incident est signalé.
- Documente les mesures mitigatrices et synchronise avec Safety pour validation.`,
  regulatory_filings: `Tu es l'Agent Déclarations Réglementaires. Prépares et suis les dépôts multi-juridictionnels.
- Rapproche les calendriers réglementaires, génère les formulaires et pilote les connecteurs portails.
- Vérifie les métadonnées PII/PI pour respecter les exigences de confidentialité et de résidence.
- Escalade HITL pour toute soumission à fort impact ou si un connecteur est hors service.`,
};

export function getFinanceCapabilityManifest(version = '2025.02-phase-b1'): FinanceCapabilityManifest {
  return {
    version,
    director: {
      instructions: DIRECTOR_INSTRUCTIONS,
      safetyEscalationPolicy: 'Toute commande à impact réglementaire, financier majeur ou impliquant des données sensibles nécessite le passage Safety ou HITL avant exécution.',
      defaultWorker: 'director',
      supportsRealtime: true,
    },
    domains: [
      {
        key: 'tax_compliance',
        displayName: 'Tax Compliance',
        description: 'Recherche fiscale, préparation de dépôts et réponses aux contrôles.',
        instructions: DOMAIN_INSTRUCTIONS.tax_compliance,
        tools: [
          {
            id: 'supabase.tax_return_status',
            type: 'supabase',
            summary: 'Consultation de l’état des dépôts fiscaux et des avis de pénalité (RPC match_tax_returns).',
            entryPoint: 'rpc:match_tax_returns',
            scopes: ['read'],
          },
          {
            id: 'function.tax_deadline_calculator',
            type: 'function',
            summary: 'Calcule les échéances fiscales selon juridiction et période.',
          },
          {
            id: 'http.tax_authority_portal',
            type: 'http',
            summary: 'Soumission des déclarations et récupération des accusés.',
            requiresConnector: true,
          },
        ],
        datasets: [
          {
            id: 'vector.tax_codes',
            description: 'Corpus des bulletins fiscaux et instructions officielles.',
            residency: 'eu',
            vectorStoreEnv: 'OPENAI_VECTOR_STORE_FINANCE_TAX',
          },
        ],
        connectors: [
          {
            type: 'tax',
            name: 'tax_authority_gateway',
            purpose: 'Déposer les déclarations et récupérer les avis.',
          },
          {
            type: 'erp',
            name: 'general_ledger',
            purpose: 'Rapprocher base fiscale et comptabilité générale.',
            optional: true,
          },
        ],
        guardrails: [
          {
            id: 'policy.tax_confidentiality',
            description: 'Protéger les données fiscales client et limites de rétention.',
            policyTag: 'policy=tax_confidentiality_v1',
          },
        ],
        telemetry: ['tax_deadline_hit_rate', 'penalty_avoidance', 'allowlisted_source_ratio'],
        hitlPolicies: ['penalty_notice_over_threshold', 'ambiguous_tax_position'],
      },
      {
        key: 'accounts_payable',
        displayName: 'Accounts Payable',
        description: 'Traitement des factures, contrôles frauduleux et planification des paiements.',
        instructions: DOMAIN_INSTRUCTIONS.accounts_payable,
        tools: [
          {
            id: 'function.invoice_ocr',
            type: 'function',
            summary: 'Extraction OCR des factures PDF/scan.',
          },
          {
            id: 'supabase.ap_policy_checker',
            type: 'supabase',
            summary: 'Validation des politiques d’approbation et seuils de délégation.',
            entryPoint: 'rpc:check_ap_policy',
            scopes: ['read'],
          },
          {
            id: 'http.erp_payments_api',
            type: 'http',
            summary: 'Création/mise à jour des bons de paiement dans l’ERP.',
            requiresConnector: true,
          },
        ],
        datasets: [
          {
            id: 'vector.ap_policies',
            description: 'Corpus des politiques dépenses, workflows d’approbation et manuels AP.',
            residency: 'global',
            vectorStoreEnv: 'OPENAI_VECTOR_STORE_FINANCE_AP',
          },
        ],
        connectors: [
          {
            type: 'erp',
            name: 'payables_module',
            purpose: 'Synchroniser factures, bons de commande et paiements.',
          },
          {
            type: 'analytics',
            name: 'fraud_scoring_service',
            purpose: 'Noter les risques de fraude et déclencher des alertes.',
            optional: true,
          },
        ],
        guardrails: [
          {
            id: 'policy.payment_authority',
            description: 'Respect des limites d’autorisation de paiement et séparation des tâches.',
            policyTag: 'policy=payment_authority_v1',
          },
        ],
        telemetry: ['invoice_cycle_time', 'fraud_alert_count', 'hitl_rate'],
        hitlPolicies: ['fraud_flag_high', 'payment_exceeds_limit'],
      },
      {
        key: 'audit_assurance',
        displayName: 'Audit & Assurance',
        description: 'Pilotage des PBC, walkthroughs et tests de contrôles.',
        instructions: DOMAIN_INSTRUCTIONS.audit_assurance,
        tools: [
          {
            id: 'supabase.control_library',
            type: 'supabase',
            summary: 'Accès aux matrices de contrôles et états de tests.',
            entryPoint: 'rpc:get_control_library',
            scopes: ['read'],
          },
          {
            id: 'function.sampling_engine',
            type: 'function',
            summary: 'Génère des échantillons statistiquement valides pour tests.',
          },
          {
            id: 'http.pbc_tracker',
            type: 'http',
            summary: 'Mise à jour des demandes PBC et suivis clients.',
            requiresConnector: true,
          },
        ],
        datasets: [
          {
            id: 'vector.audit_workpapers',
            description: 'Bibliothèque de programmes d’audit, gabarits de walkthrough et documentation SOX.',
            residency: 'global',
            vectorStoreEnv: 'OPENAI_VECTOR_STORE_FINANCE_AUDIT',
          },
        ],
        connectors: [
          {
            type: 'compliance',
            name: 'grc_platform',
            purpose: 'Synchroniser risques, contrôles et plans de remédiation.',
          },
        ],
        guardrails: [
          {
            id: 'policy.audit_independence',
            description: 'Règles d’indépendance et interférence limitée avec la production.',
            policyTag: 'policy=audit_independence_v1',
          },
        ],
        telemetry: ['control_failure_rate', 'pbc_on_time', 'hitl_blocks'],
        hitlPolicies: ['control_failure_critical', 'evidence_missing'],
      },
      {
        key: 'cfo_strategy',
        displayName: 'CFO Strategy',
        description: 'Analyses financières, scénarios et livrables exécutifs.',
        instructions: DOMAIN_INSTRUCTIONS.cfo_strategy,
        tools: [
          {
            id: 'analytics.kpi_service',
            type: 'analytics',
            summary: 'Extraction KPI (réel vs budget, cash burn, variances).',
            requiresConnector: true,
          },
          {
            id: 'openai.board_deck_generator',
            type: 'openai',
            summary: 'Génère des slides et narratifs CFO avec contrôle Safety.',
          },
          {
            id: 'function.scenario_planner',
            type: 'function',
            summary: 'Simulations multi-scénarios (sensibilités, stress tests).',
          },
        ],
        datasets: [
          {
            id: 'vector.finance_kpi_library',
            description: 'Corpus des modèles financiers, définitions KPI, playbooks board.',
            residency: 'global',
            vectorStoreEnv: 'OPENAI_VECTOR_STORE_FINANCE_CFO',
          },
        ],
        connectors: [
          {
            type: 'analytics',
            name: 'bi_warehouse',
            purpose: 'Récupérer les indicateurs consolidés et rapports dynamiques.',
          },
        ],
        guardrails: [
          {
            id: 'policy.forward_looking',
            description: 'Gestion des déclarations prospectives et obligations d’avertissement.',
            policyTag: 'policy=forward_looking_v1',
          },
        ],
        telemetry: ['scenario_count', 'manual_override_rate', 'disclosure_hits'],
        hitlPolicies: ['material_guidance_change', 'regulation_fd_sensitive'],
      },
      {
        key: 'risk_controls',
        displayName: 'Risk & Controls',
        description: 'Suivi des risques, efficacité des contrôles, remédiations.',
        instructions: DOMAIN_INSTRUCTIONS.risk_controls,
        tools: [
          {
            id: 'supabase.risk_register',
            type: 'supabase',
            summary: 'Lecture/écriture du registre des risques et plans de remédiation.',
            entryPoint: 'table:risk_register',
            scopes: ['read', 'write'],
          },
          {
            id: 'function.risk_scoring_engine',
            type: 'function',
            summary: 'Calcule les scores de risques, tendances et seuils HITL.',
          },
          {
            id: 'http.incident_portal',
            type: 'http',
            summary: 'Synchronise incidents et plans d’action depuis la plateforme GRC.',
            requiresConnector: true,
          },
        ],
        datasets: [
          {
            id: 'vector.risk_library',
            description: 'Taxonomie des risques, contrôles clés, plans de mitigation et obligations SOX.',
            residency: 'global',
            vectorStoreEnv: 'OPENAI_VECTOR_STORE_FINANCE_RISK',
          },
        ],
        connectors: [
          {
            type: 'compliance',
            name: 'grc_platform',
            purpose: 'Aligner registre des risques, incidents et contrôles.',
          },
          {
            type: 'analytics',
            name: 'telemetry_dashboard',
            purpose: 'Ingestion des métriques de surveillance continue.',
            optional: true,
          },
        ],
        guardrails: [
          {
            id: 'policy.incident_disclosure',
            description: 'Publication contrôlée des incidents et exigences réglementaires.',
            policyTag: 'policy=incident_disclosure_v1',
          },
        ],
        telemetry: ['risk_score_average', 'hitl_trigger_rate', 'remediation_age'],
        hitlPolicies: ['risk_score_above_threshold', 'incident_requires_disclosure'],
      },
      {
        key: 'regulatory_filings',
        displayName: 'Regulatory Filings',
        description: 'Préparation et suivi des dépôts multi-juridictionnels.',
        instructions: DOMAIN_INSTRUCTIONS.regulatory_filings,
        tools: [
          {
            id: 'supabase.filing_calendar',
            type: 'supabase',
            summary: 'Consultation et mise à jour du calendrier réglementaire.',
            entryPoint: 'table:regulatory_calendar',
            scopes: ['read', 'write'],
          },
          {
            id: 'function.filing_package_builder',
            type: 'function',
            summary: 'Assemble les dossiers de dépôt (pièces, formulaires, attestations).',
          },
          {
            id: 'http.regulatory_portal',
            type: 'http',
            summary: 'Interface avec les portails gouvernementaux pour dépôt et accusé.',
            requiresConnector: true,
          },
        ],
        datasets: [
          {
            id: 'vector.regulatory_guides',
            description: 'Guides, FAQ et instructions de dépôt par juridiction.',
            residency: 'global',
            vectorStoreEnv: 'OPENAI_VECTOR_STORE_FINANCE_REG',
          },
        ],
        connectors: [
          {
            type: 'tax',
            name: 'regulatory_portal',
            purpose: 'Soumettre les dossiers et récupérer les confirmations officielles.',
          },
          {
            type: 'compliance',
            name: 'obligation_registry',
            purpose: 'Maintenir la liste des obligations et contrôles associés.',
            optional: true,
          },
        ],
        guardrails: [
          {
            id: 'policy.regulatory_disclosure',
            description: 'Respect des obligations de confidentialité et PII avant soumission.',
            policyTag: 'policy=regulatory_disclosure_v1',
          },
        ],
        telemetry: ['filing_on_time', 'hitl_review_count', 'submission_error_rate'],
        hitlPolicies: ['high_impact_filing', 'portal_failure'],
      },
    ],
  };
}
