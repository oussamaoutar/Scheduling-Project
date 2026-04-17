# Rapport des Modifications Frontend — AutoMaroc Scheduling

Ce document récapitule l'ensemble des travaux effectués sur l'interface utilisateur (frontend) de l'application **AutoMaroc Scheduling**. L'objectif était de transformer une base simple en une application industrielle moderne, robuste et prête pour la soutenance.

## 1. Stack Technique & Architecture

- **Outil de Build** : Vite.js (pour des performances de développement optimales).
- **Langages** : JavaScript Vanilla (ES6+) pour la logique, HTML5 Sémantique.
- **Styling** : Tailwind CSS (utilitaires) couplé à un système de design personnalisé (`design-system.css`).
- **Graphiques** : Chart.js (Dashboard & Historique) et Canvas API (Diagramme de Gantt sur-mesure).

## 2. Système Core (Router & State)

- **Router SPA** (Hash-based) :
    - Navigation fluide sans rechargement de page.
    - **Transitions** : FadeIn/FadeOut animés (100-150ms).
    - **Loader** : Barre de progression fine en haut de l'écran (style NProgress).
    - **Gestion 404** : Page d'erreur personnalisée avec illustration robotique.
- **State Management** :
    - Store global basé sur `Proxy` (`src/utils/state.js`) pour synchroniser les données entre les pages (ex: sélection d'OFs persistante vers l'ordonnancement).
- **Services API** :
    - Wrapper `fetchAPI` avec gestion globale des erreurs (401, 404, 500).
    - Système de timeout automatique (10s) pour éviter les requêtes infinies.

## 3. Pages Implémentées

| Page | Description & Fonctionnalités Clés |
| :--- | :--- |
| **Dashboard** | Vue d'ensemble avec 6 cartes KPI, répartition des statuts OFs et Top 5 machines par capacité. |
| **Machines** | Gestion complète (CRUD) des équipements avec filtrage par type et statut. |
| **Jobs** | Gestion des Ordres de Fabrication (OF) avec priorités et dates de livraison. |
| **Opérations** | Configuration des gammes de fabrication (lien Job <-> Machine). |
| **Ordonnancement** | Wizard en 3 étapes : 1. Info Run, 2. Sélection Algo (SPT, LPT, EDD, Johnson, CDS), 3. Sélection des OFs avec contrôle de contraintes. |
| **Gantt** | Visualisation interactive sur un axe temporel. Affiche les tâches par machine et surligne les imprévus. |
| **Comparaison** | Benchmarking de plusieurs algorithmes sur les mêmes jobs pour identifier le plus performant. |
| **Imprévus** | Monitoring en temps réel des pannes machine, manques matières et absences. |
| **Historique** | Analyse des performances passées, taux de disponibilité et répartition des causes d'arrêt. |

## 4. Composants UI & UX Avancés

- **Diagramme de Gantt Custom** : Développé entièrement en Canvas pour supporter des centaines de tâches sans ralentissement. Inclut un export au format PNG.
- **Skeletons Loaders** : États de chargement animés ("shimmer") pour chaque page.
- **Confirm Modals** : Modals de suppression sécurisés avec animation "shake" en cas d'erreur.
- **Toast Notifications** : Retours visuels immédiats pour chaque action (Succès, Erreur, Info).
- **Raccourcis Clavier** : Navigation rapide (`Alt+D` pour Dashboard, `Alt+G` pour Gantt, etc.).

## 5. Mode Démonstration (Offline Capability)

Un système d'interception API (`src/utils/demo-data.js`) a été intégré :
- **Données Réalistes** : 6 machines automobiles (Presse, Soudure, Peinture...), 4 OFs complexes, et des runs d'exemple.
- **Mocking** : Intercepte les appels `fetch` et renvoie les données simulées si le backend Django n'est pas accessible.
- **Détection d'Atelier** : Logiciel capable de détecter automatiquement si l'atelier est un *Flow Shop* ou *Job Shop* selon les gammes saisies.

## 6. Optimisations Visuelles (Finition Soutenance)

- **Palette de couleurs** : Harmonisation autour du Bleu AutoMaroc (`#378ADD`) et dégradés subtils.
- **Typography** : Utilisation de la police *Inter* pour une lisibilité maximale.
- **Responsive** : Sidebar rétractable et tables scrollables pour une utilisation sur tablettes et mobiles.
- **Favicon** : Icone engrenage SVG intégrée.

---
*Ce document sert de base technique pour expliquer les choix de conception lors de la présentation orale.*
