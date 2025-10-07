# Playbook de gestion des changements

## 1. Objectifs
Assurer que toute évolution du système (prompts, outils, schéma, UI, politiques) soit évaluée, testée et communiquée sans rupture de service ni régression de conformité.

## 2. Cycle de changement
1. **Proposition** – Ticket détaillé (description, justification, périmètre, risques) créé dans le backlog produit.
2. **Évaluation** – Revue croisée (Produit, Juridique, SRE). Analyse d'impact sur la précision, la conformité, la disponibilité.
3. **Validation** – Comité hebdomadaire (Change Advisory Board) attribue une fenêtre de déploiement.
4. **Préparation** – Mise à jour des tests, exécution des migrations en staging, validation du plan de rollback.
5. **Déploiement** – Procédure standard (CI/CD). Monitoring renforcé durant 24h.
6. **Revue post-déploiement** – Vérification des métriques clés, collecte des retours utilisateurs, documentation.

## 3. Classifications
| Niveau | Exemple | Processus |
| --- | --- | --- |
| **Standard** | Mise à jour mineure UI, ajout d'un template, correction de bug. | CAB hebdomadaire + check-list standard. |
| **Majeur** | Nouvelle juridiction, modification des gardes de sécurité, changement de modèle. | CAB + test de charge + annonce client 7 jours avant. |
| **Urgent** | Patch de sécurité, incident critique. | Processus incident + post-mortem obligatoire. |

## 4. Check-list standard
- Tests automatisés (lint, unitaires, intégration, e2e) réussis.
- Validation des migrations Supabase et sauvegarde préalable.
- Mise à jour de la documentation (README, guides, politiques).
- Communication interne (release notes) et clients (si impact fonctionnel).

## 5. Registre des versions
- Historique conservé dans `ops/reports/change-log.md` (date, auteur, description, niveau, approbateurs).
- Revue trimestrielle par le comité de gouvernance.
