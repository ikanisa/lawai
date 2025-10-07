# Politique d'IA responsable – Avocat-AI Francophone

## 1. Objet et champ d'application
Cette politique formalise les garde-fous techniques, organisationnels et éthiques qui encadrent l'utilisation de l'agent juridique autonome Avocat-AI Francophone sur l'ensemble des juridictions couvertes (France, Belgique, Luxembourg, Suisse francophone, Monaco, Canada/Québec, Maghreb et 17 États OHADA). Elle s'applique à tous les utilisateurs internes, clients, sous-traitants et partenaires impliqués dans l'exploitation de la plateforme.

## 2. Principes directeurs
1. **Compétence et diligence** – Toute réponse générée doit être vérifiée avant usage professionnel et rester conforme au cadre déontologique des juridictions concernées. Les utilisateurs sont formés aux limites fonctionnelles et aux bonnes pratiques d'audit.
2. **Cite-or-refuse** – L'agent ne remet des conclusions que lorsque des sources officielles allowlistées sont disponibles. À défaut, il déclenche un refus motivé et recommande une escalade HITL.
3. **Transparence** – Les sorties sont structurées en IRAC, accompagnées de citations, de dates d'entrée en vigueur, de statuts de consolidation et d'avertissements sur la langue juridiquement contraignante (Maghreb, OHADA).
4. **Supervision humaine** – Les sujets à risque élevé (contentieux pénal, sanctions, conflits de lois, absence de source officielle) basculent automatiquement en revue humaine avec piste d'audit.
5. **Confidentialité** – Le mode confidentiel désactive la recherche web et garantit que les données client ne quittent pas l'aire d'hébergement Supabase ; aucun contenu confidentiel n'est réutilisé pour l'apprentissage sans opt-in explicite du client.
6. **Traçabilité** – Chaque exécution journalise les sources consultées, les invocations d'outils, les décisions de l'agent et les interventions HITL. Les journaux sont conservés conformément aux politiques de rétention.
7. **Conformité réglementaire** – Les flux de données et les obligations contractuelles respectent les cadres européens (RGPD), africains (NDPR, LOI 2008-12 Sénégal), canadiens (LPRPDE) et les recommandations TOJI/State Bar of Texas sur l'usage de l'IA en pratique juridique.

## 3. Responsabilités
- **Équipe Produit & Ingénierie** : maintien des garde-fous techniques, revue trimestrielle des prompts et outils, publication des changements dans le registre de versions.
- **Équipe Juridique & Conformité** : validation des politiques, suivi des obligations déontologiques, audit des sorties, coordination avec les autorités réglementaires.
- **Équipe Opérations & Support** : gestion des incidents, animation des revues HITL, formation des utilisateurs et collecte du feedback client.
- **Clients** : désignation d'un référent conformité, respect des conditions d'utilisation, remontée immédiate de tout incident ou anomalie.

## 4. Processus de validation des sorties
1. **Validation automatique** – Contrôles de cohérence : respect du schéma IRAC, citations allowlistées, datation, statut linguistique, score qualité des décisions.
2. **Détection de risque** – Calcul automatique du niveau de risque (LOW/MEDIUM/HIGH) combinant nature de la demande, juridiction, fiabilité des sources et historique utilisateur.
3. **Escalade HITL** – Tout cas flaggé HIGH, toute absence de source officielle ou toute traduction non contraignante déclenche la création d'une tâche de revue avec horodatage et assignation.
4. **Revue et clôture** – Le réviseur documente son action (approbation, demande de modification, rejet) et l'agent réintègre les corrections dans le pipeline d'apprentissage (denylist, synonymes, ajustement de politiques).

## 5. Gestion des données et confidentialité
- **Stockage** : séparation stricte entre le cache d'autorités publiques (buckets `authorities`/`snapshots`) et les documents clients (`uploads`) avec RLS par organisation.
- **Chiffrement** : TLS en transit, chiffrement au repos via Supabase, rotations de clés gérées par l'équipe sécurité.
- **Partage** : aucune donnée client n'est partagée avec OpenAI hors des appels strictement nécessaires au fonctionnement de l'agent (modèle, File Search, outils) ; les identifiants sont pseudonymisés.
- **Droits des personnes** : procédures internes pour l'exercice des droits RGPD (accès, rectification, effacement, opposition) dans un délai maximum de 30 jours.

## 6. Formation et sensibilisation
- Parcours d'onboarding obligatoire incluant : fonctionnement de l'agent, limites, obligations déontologiques, scénarios HITL, gestion des incidents.
- Sessions semestrielles de remise à niveau et diffusion des évolutions réglementaires ou fonctionnelles.

## 7. Révision et gouvernance
- **Comité IA Responsable** : réunit Produit, Juridique, Sécurité et Représentants clients ; cadence trimestrielle.
- **Audits** : auto-évaluation trimestrielle + audit externe annuel ; revue des indicateurs (précision des citations ≥95 %, validité temporelle ≥95 %, bannière Maghreb 100 %, HITL recall ≥98 %).
- **Mise à jour** : toute modification substantielle est diffusée aux clients avec un préavis de 15 jours et consignée dans le registre des politiques.

## 8. Entrée en vigueur
Cette politique entre en vigueur à la date de son adoption par le comité IA Responsable et demeure applicable tant que l'agent Avocat-AI Francophone est exploité en production.
