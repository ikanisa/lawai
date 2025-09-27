# Guide du tableau de gouvernance

## 1. Objectif
Expliquer comment interpréter les métriques exposées dans la vue Admin (Operations dashboard) et dans les exports Supabase (`org_metrics`, `tool_performance_metrics`).

## 2. KPIs principaux
- **Runs (30 jours)** : volume récent d'exécutions. Permet de suivre l'adoption et dimensionner le support.
- **Précision allowlist** : ratio de citations issues des domaines autorisés. Objectif ≥95 %. Toute baisse doit déclencher une analyse des connecteurs ou du routage.
- **Relectures en attente** : charge actuelle de la file HITL. Le délai médian doit rester ≤4 h.
- **Runs confidentiels** : proportion de requêtes en mode Confidential Mode ; indicateur de sensibilité des sujets traités.
- **Ingestion (7 jours)** : succès/échecs des crawlers par adaptateur. Objectif ≥97 % de succès.
- **Évaluations** : taux de réussite des golden sets ; mesure la qualité de la RAG et des garde-fous.

## 3. Performance des outils
Tableau par outil avec :
- Latence moyenne et P95 (ms) – surveiller tout dépassement des budgets.
- Nombre d'échecs vs total – déclencheur d'investigations (ex. Web Search throttling, File Search indisponible).
- Dernier appel – vérifie que les outils critiques restent utilisés (ex. `lookupCodeArticle`).

## 4. Exploitation opérationnelle
- **Alertes** : configurer des seuils sur la vue `org_metrics` (ex. `allowlisted_citation_ratio < 0.9`).
- **Rapports** : exporter mensuellement les données pour audit (format CSV via Supabase).
- **Retours clients** : croiser les métriques avec le feedback support pour prioriser les améliorations.

## 5. Limites et évolutions
- Les métriques agrègent toutes les organisations ; pour une segmentation fine, appliquer un filtrage `eq('org_id', ...)`.
- Ajouter à terme des indicateurs de drift (score cases, synonymes), des statistiques de bande passante et des corrélations HITL vs score qualité.
