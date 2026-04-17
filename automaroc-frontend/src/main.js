/**
 * main.js — Point d'entrée de l'application AutoMaroc Scheduling
 *
 * 1. Monte le layout (sidebar + topbar + zone contenu)
 * 2. Init le router (hash SPA)
 */

import { initLayout, setActiveNav } from './components/layout.js';
import { initRouter }               from './router.js';
import { patchApiWithDemo }         from './utils/demo-data.js';

// ⚠ MODE DEMO ACTIF — données automobiles simulées (retirer quand le backend Django tourne)
// Pour désactiver : mettre false ci-dessous, ou supprimer cette ligne
window.DEMO_MODE = true;
patchApiWithDemo();


// ─── Bootstrap ────────────────────────────────────────────────────────────────

function bootstrap() {
  // 1. Injecter le shell de l'application (sidebar + topbar + #am-content)
  initLayout();

  // 2. Démarrer le routeur — les pages seront rendues dans #am-content
  initRouter();

  // 3. Synchronise le lien actif à chaque changement de hash
  window.addEventListener('hashchange', () => {
    setActiveNav(window.location.hash);
  });

  // 4. Active le lien correspondant à la route initiale
  setActiveNav(window.location.hash || '#/dashboard');

  // 5. Écoute du refresh global (bouton ↺ topbar)
  window.addEventListener('automaroc:refresh', () => {
    // Redéclenche la navigation courante pour rafraîchir la page active
    window.dispatchEvent(new HashChangeEvent('hashchange', {
      oldURL: '',
      newURL: window.location.hash || '#/dashboard',
    }));
  });
}

// Lance au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
