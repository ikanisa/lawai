# Politique DPIA & Engagements Conseil de l'Europe

Nous publions la présente fiche pour documenter la conformité de l'agent Avocat-AI Francophone aux exigences de la loi européenne sur l'IA, du RGPD et du futur traité du Conseil de l'Europe sur l'IA.

## DPIA (Analyse d'impact relative à la protection des données)

- **Responsable du traitement** : Avocat-AI Francophone (programme OHADA & UE).
- **Finalités** : assistance juridique augmentée, génération de plans IRAC, alertes de conformité, et préparation de projets d'actes.
- **Catégories de données** : demandes utilisateurs, métadonnées de recherche, décisions HITL, journaux d'audit, documents officiels stockés dans la bibliothèque d'autorités.
- **Mesures techniques et organisationnelles** : chiffrement au repos, journalisation immuable, politiques de rétention, séparation stricte entre données publiques et privées, revues humaines obligatoires pour les usages à risque.
- **Analyse des risques** : biais jurisprudentiels, erreurs d'interprétation de droit local, dérives temporelles, expositions transfrontalières. Ces risques sont surveillés par les rapports nocturnes de dérive et l'évaluation continue (LegalBench/LexGLUE).

## Engagements vis-à-vis du Conseil de l'Europe (Convention-cadre sur l'IA)

- **Transparence** : publication de ce registre, accès API `/governance/publications`, tableaux de bord SLO et rapports de conformité CEPEJ.
- **Surveillance humaine** : revues HITL obligatoires, bouton "Soumettre à revue" dans l'interface, audit trail signé.
- **Responsabilité** : journalisation des actions opérateurs, Go/No-Go checklist et diffusion automatique des rapports aux régulateurs via le digest hebdomadaire.
- **Égalité et non-discrimination** : tests CEPEJ automatisés, indicateurs de dérive et suivi des scores de fiabilité des jurisprudences.
- **Sécurité** : contrôle d'accès RBAC × ABAC, politiques de zones de résidence, détection de compromission (sous forme de tickets guardrail).

La version la plus récente de cette fiche est enregistrée dans la table `governance_publications` (slug : `dpia-commitments`) et exposée via l'API afin de garantir un suivi continu.
