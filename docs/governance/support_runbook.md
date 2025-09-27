# Runbook support & astreinte

## Objectif
Décrire les procédures d'escalade 24/5, les responsabilités et les scénarios types pour accompagner les clients pendant les phases pilote puis la production.

## Couverture
- Support fonctionnel (questions juridiques, signalement d'anomalies).
- Support technique (indisponibilité API, erreurs d'ingestion, incidents PWA).
- Escalades conformité (HITL bloqué, surveillance FRIA, alertes CEPEJ).

## Organisation
1. **Niveau 1 – Support produit**  
   - Horaires : 07h–19h CET du lundi au vendredi.  
   - Outils : Zendesk + canal Slack partagé + page de statut.  
   - Rôle : qualifier la demande, vérifier si un incident est déjà ouvert, appliquer les FAQ.
2. **Niveau 2 – Équipe Ops/LegalTech**  
   - Horaires : astreinte 24/5 (rotation hebdomadaire).  
   - Rôle : investiguer, déclencher le runbook incident, communiquer avec le client pilote.
3. **Niveau 3 – Direction produit & conformité**  
   - Horaires : astreinte en cas de crise (incident P1, notification régulateur).  
   - Rôle : prise de décision Go/No-Go, communication externe, coordination juridique.

## Processus de traitement
1. Enregistrement dans l’outil support avec ID unique et classification (fonctionnel / technique / conformité).
2. Vérification des indicateurs de santé (SLO, latence HITL, statut des crawlers).
3. Communication initiale au client (accusé de réception + ETA).
4. Traitement ou escalade selon la matrice de gravité.  
   - P1 : indisponibilité totale, fuite de données, erreur juridique majeure.  
   - P2 : dégradation partielle (latence, bannière linguistique manquante).  
   - P3 : questions de configuration ou demandes d’amélioration.
5. Clôture avec résumé, actions correctives, mise à jour du change log.

## Indicateurs & reporting
- Temps moyen de première réponse (objectif : < 15 min).  
- Temps moyen de résolution par gravité.  
- Nombre d’incidents par semaine/pilote.  
- Feedback client (CSAT) après clôture.

## Documentation de référence
- [Plan de réponse aux incidents](incident_response_plan.md)
- [Playbook de gestion des changements](change_management_playbook.md)
- [SLO & support opérationnel](slo_and_support.md)
