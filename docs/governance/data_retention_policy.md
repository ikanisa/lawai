# Politique de conservation des données

## 1. Principes généraux
- Minimiser la conservation aux besoins opérationnels, réglementaires et contractuels.
- Séparer les données publiques (autorités) et les données confidentielles (clients) avec politiques distinctes.
- Offrir aux clients un contrôle granulaire sur la durée de conservation par type de contenu.

## 2. Durées par catégorie
| Catégorie | Description | Durée par défaut | Action à l'échéance |
| --- | --- | --- | --- |
| **Sources officielles** | Documents ingérés (statuts, codes, jurisprudence) dans les buckets `authorities`/`snapshots`. | Indéfinie (jusqu'à révocation légale). | Vérification annuelle et purge des versions obsolètes après archivage externe. |
| **Documents clients** | Fichiers uploadés via le mode confidentiel. | 3 ans (personnalisable par org : 6 mois à 5 ans). | Suppression cryptographique (wipe + rotation de clé bucket). |
| **Agent runs & logs** | Entrées `/runs`, IRAC, citations, logs d'outils, télémetries. | 2 ans. | Anonymisation (suppression des prompts, conservation des métriques agrégées). |
| **HITL records** | Files de revue, commentaires, résolutions. | 5 ans (exigences réglementaires). | Archivage chiffré puis purge. |
| **Évaluations & métriques** | Golden sets, résultats, rapports. | Durée de vie du client + 1 an. | Export vers stockage froid avant suppression. |

## 3. Processus d'effacement
1. Recevoir la demande (client, délégué à la protection des données, utilisateur final).
2. Vérifier l'éligibilité (contrat, obligations légales).
3. Planifier l'exécution (script Supabase + rotation de clés si nécessaire).
4. Documenter la suppression (journal d'audit + confirmation envoyée au demandeur).

## 4. Sauvegardes
- Sauvegarde chiffrée quotidienne (point-in-time) avec rétention de 30 jours.
- Sauvegarde hebdomadaire hors site (immuable) conservée 6 mois.
- Tests de restauration trimestriels avec procès-verbal.

## 5. Conformité
- Respect des exigences RGPD (droit à l'effacement, portabilité) et LGPD/LOI 2008-12.
- Audit annuel des politiques de rétention, ajustements selon évolutions réglementaires.
