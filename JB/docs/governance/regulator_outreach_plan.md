# Plan de communication régulateurs

## Objectif
Garantir une communication proactive et documentée avec les autorités (CNIL, CSA, Barreaux, autorités OHADA) avant et après le lancement de l’agent juridique autonome.

## Gouvernance
- **Owner** : Responsable conformité & affaires publiques.  
- **Copilotes** : CTO (aspects techniques), Directrice juridique (risques professionnels), Responsable produit (roadmap & changements).

## Cadence & livrables
| Fréquence | Public | Contenu | Canal |
| --- | --- | --- | --- |
| Mensuel | CNIL / autorités protection données | Rapport synthétique (FRIA, incidents, SLO, changements de modèle) | Portail sécurisé + e-mail chiffré |
| Trimestriel | Barreaux, Conseils de l’ordre, Ministère de la Justice | Démonstration contrôlée, rapport de conformité CEPEJ, feuille de route produits | Sessions visio + mémo PDF |
| À chaud (<24h) | Autorités concernées selon territoire | Notification incident majeur (sécurité, conformité, UPL) avec actions correctives | Téléphone + e-mail officiel |
| Annuel | Tous régulateurs et clients | Rapport de transparence complet + audit externe | Publication centre de confiance + webinaire |

## Processus d’alerte
1. Identification de l’événement (incident P1, mise à jour majeure du modèle, demande régulateur).  
2. Évaluation par le comité conformité (gravité, territoires impactés, délais).  
3. Préparation du dossier (résumé exécutif, données chiffrées, mesures prises).  
4. Validation direction générale.  
5. Diffusion via canaux approuvés et archivage dans `regulator_dispatches`.

## KPI
- Respect des délais réglementaires (<24h incidents critiques).  
- Taux de réponse des autorités (<5 jours ouvrés).  
- Nombre de feedbacks intégrés dans la roadmap ou le change log.

## Références
- [DPIA & engagements Conseil de l’Europe](dpia_commitments.md)  
- [Charte éthique CEPEJ](cepej_charter_mapping.md)  
- [Plan de réponse aux incidents](incident_response_plan.md)  
- [Transparence & SLO](slo_and_support.md)
