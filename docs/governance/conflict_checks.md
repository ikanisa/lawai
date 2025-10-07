# Procédure de détection des conflits d'intérêts

## 1. Objectifs
Garantir qu'aucune réponse générée par l'agent ne mette l'organisation ou ses clients en situation de conflit d'intérêts, notamment lorsqu'un même utilisateur représente plusieurs parties ou lorsque des matières sensibles (sanctions, pénal, concurrence) sont traitées.

## 2. Périmètre
- Toutes les organisations clientes et leurs entités affiliées.
- Les utilisateurs internes (équipe support, experts métier) ayant accès au mode HITL.
- Les documents importés dans le bucket `uploads` via le mode confidentiel.

## 3. Processus
1. **Collecte d'informations**
   - Chaque organisation renseigne, via le module Admin, la liste des parties adverses, clients conflictuels et restrictions de juridictions.
   - Les utilisateurs associent chaque requête à un dossier/matter existant lors de la soumission (Matters API).
2. **Analyse automatique**
   - L'API `/runs` vérifie systématiquement si le `matter_id` est associé à un conflit déclaré ; en cas d'alerte, l'exécution est bloquée et un ticket HITL est créé.
   - Les documents importés sont hashés et comparés à la table `conflict_documents` (future extension) pour détecter les doublons interdits.
3. **Revue humaine**
   - L'équipe conformité reçoit une notification (webhook + tableau de bord Admin) et statue : autorisation exceptionnelle, redirection vers une autre équipe, ou interdiction.
   - Les décisions sont enregistrées avec horodatage, relecteur et justification.
4. **Audit**
   - Export mensuel des conflits détectés, de leur résolution et des mesures correctives ; conservation pendant 5 ans.

## 4. Responsabilités
- **Clients** : maintien de la liste des parties adverses et mise à jour des restrictions.
- **Équipe Conformité** : supervision du processus, revue des alertes, tenue du registre.
- **Équipe Produit** : implémentation et maintien des contrôles automatiques.

## 5. Outils & intégrations
- Table Supabase `org_conflict_parties` (à créer) pour stocker les interdictions par org.
- Webhooks Slack/Teams pour les alertes critiques.
- Rapports exports (`ops/reports/conflicts-YYYY-MM.csv`).

## 6. Mise à jour
Procédure revue chaque semestre ou à la suite d'un incident majeur.
