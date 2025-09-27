# Plan de réponse aux incidents

## 1. Types d'incidents
- **Sécurité** : compromission de compte, fuite de données, accès non autorisé aux buckets.
- **Qualité** : réponse erronée ayant entraîné un risque juridique majeur, absence de bannière Maghreb.
- **Disponibilité** : indisponibilité de l'API, défaillance des Edge Functions, panne Supabase/OpenAI.

## 2. Organisation
- **Incident Commander (IC)** : responsable produit – coordonne l'ensemble des actions et communication.
- **Responsable technique** : ingénieur on-call – diagnostic et remédiation technique.
- **Responsable conformité** : juriste référent – évaluation de l'impact réglementaire, notifications légales.
- **Communication** : marketing/CS – relation clients et communication externe.

## 3. Processus en 6 étapes
1. **Détection** (monitoring, alertes clients, red-team) → enregistrement dans `ops/incidents`.
2. **Qualification** (gravité, périmètre, données impactées) → décision d'escalade.
3. **Confinement** (désactivation temporaire de fonctionnalités, isolation des clés, suspension des webhooks).
4. **Remédiation** (correctifs code/config, purge de données, rotation d'identifiants, redéploiement).
5. **Communication** (notification clients ≤24h, autorités compétentes selon la juridiction, rapport interne).
6. **Rétrospective** (post-mortem dans les 5 jours, plan d'actions, mise à jour des politiques et formation).

## 4. SLA d'investigation
| Niveau | Description | Délai de prise en charge |
| --- | --- | --- |
| P0 | Fuite de données, incident réglementaire critique | < 30 minutes |
| P1 | Indisponibilité totale, réponse juridique erronée majeure | < 1 heure |
| P2 | Dégradation partielle (latence, ingestion retardée) | < 4 heures |
| P3 | Anomalie mineure | < 24 heures |

## 5. Journaux & traçabilité
- Ticket unique (ID) avec horodatage, responsables et décisions.
- Enregistrements des étapes (détection, confinement, remédiation, validation).
- Conservation des journaux d'incident 5 ans.

## 6. Tests & exercices
- Exercice table-top trimestriel (scénario sécurité + disponibilité).
- Test de restauration (panne Supabase) semestriel.
- Rapport annuel consolidé pour le comité de gouvernance.
