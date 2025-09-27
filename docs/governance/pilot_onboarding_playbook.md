# Playbook d'onboarding pilote

## 1. Préparation
- **Kick-off** : réunion initiale (Produit, Juridique, IT client) pour cadrer les objectifs, domaines couverts et restrictions.
- **Due diligence** : revue des politiques client (sécurité, confidentialité), signature du DPA, configuration SSO/IP allowlist.
- **Provisioning** : création du tenant Supabase, import du corpus initial (Drive blueprint), configuration des feature flags.

## 2. Formation
- Session live (2h) : fonctionnement de l'agent, navigation UI, processus HITL, bonnes pratiques de prompts.
- Modules asynchrones : vidéos, guides PDF, check-lists.
- Questionnaire de validation (obligatoire) avant accès production.

## 3. Phase pilote (6 semaines)
| Semaine | Objectifs | Livrables |
| --- | --- | --- |
| 1 | Mise en route, collecte des premières requêtes | Rapport hebdo, support prioritaire |
| 2-3 | Élargissement des cas d'usage | Suivi précision citations, latence |
| 4 | Évaluation intermédiaire | Atelier feedback, plan d'amélioration |
| 5 | Ajustements, intégration workflows internes | Templates personnalisés, connecteurs Drive |
| 6 | Bilan & décision go-live | Scorecard finale, plan de support |

## 4. Indicateurs de succès
- ≥95 % de précision allowlist et validité temporelle.
- ≥90 % des requêtes routées sans intervention HITL hors cas sensibles.
- Satisfaction utilisateur ≥4/5.

## 5. Clôture
- Présentation bilan au comité client.
- Signature du procès-verbal pilote.
- Transition vers le contrat de production (SLA, support, cadence d'évaluation).
