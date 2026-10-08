// ============================================================
//  GREC GROUP — Utilitaires JS globaux
// ============================================================

// ── Échappement HTML (à utiliser avant tout insertion dans innerHTML) ──
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// URL d'image sûre : uniquement http(s) ou chemin relatif
function safeImageUrl(url) {
  const value = String(url || '').trim();
  return /^(https?:\/\/|\.{0,2}\/|[\w-]+\/)/i.test(value) && !/^\s*javascript:/i.test(value) ? value : '';
}

// ── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  // Affiche une notification toast temporaire en bas de l'écran
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span style="font-size:16px">${icons[type] || icons.info}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Scroll Reveal ────────────────────────────────────────────
function initScrollReveal() {
  // Observer pour révéler les éléments avec l'effet d'animation au scroll
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => {
    if (el.dataset.revealInit === 'true') return;
    el.dataset.revealInit = 'true';
    observer.observe(el);
  });
}

// ── Navbar Scroll Effect ─────────────────────────────────────
function initNavbar() {
  // Applique un style collant et contrasté sur la barre de navigation au scroll
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  function updateNavbar() {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
      navbar.classList.remove('transparent');
    } else {
      navbar.classList.remove('scrolled');
      navbar.classList.add('transparent');
    }
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });
  updateNavbar();
}

// ── Mobile Menu ───────────────────────────────────────────────
function initMobileMenu() {
  // Active le menu mobile et ferme automatiquement le panneau lorsque l'on clique sur un lien
  const btn   = document.getElementById('mobile-menu-btn');
  const menu  = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  if (btn.dataset.menuReady === 'true') return;
  btn.dataset.menuReady = 'true';

  btn.addEventListener('click', () => {
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
  });

  // Fermer au clic sur un lien
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

function getAuthLoginHref() {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/admin/')) return '../pages/auth.html';
  if (path.includes('/pages/')) return 'auth.html';
  return 'pages/auth.html';
}

function getAdminHref() {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/admin/')) return 'index.html';
  if (path.includes('/pages/')) return '../admin/index.html';
  return 'admin/index.html';
}

function getAdminName(user) {
  return (user?.displayName || user?.email || 'Admin').toString().trim();
}

function getMemberDisplayName(data = {}, user = null) {
  const stored = String(data.nom || '').trim();
  const prenom = String(data.prenom || '').trim();
  const nomFamille = String(data.nomFamille || '').trim();

  if (stored && stored.includes(' ')) return stored;
  if (prenom && nomFamille) return `${prenom} ${nomFamille}`.trim();
  if (prenom && stored && prenom.toLowerCase() !== stored.toLowerCase()) return `${prenom} ${stored}`.trim();
  if (user?.displayName) return String(user.displayName).trim();
  if (stored) return stored;
  return user?.email || 'Membre';
}

function getValidationLabel(status) {
  return VALIDATION_LABELS[status] || VALIDATION_LABELS[VALIDATION_STATUS.PENDING];
}

function getValidationBadgeClass(status) {
  if (status === VALIDATION_STATUS.APPROVED) return 'badge-green';
  if (status === VALIDATION_STATUS.REJECTED) return 'badge-red';
  return 'badge-gold';
}

function normalizeValidationStatus(value, publie) {
  if (value === VALIDATION_STATUS.APPROVED || value === VALIDATION_STATUS.REJECTED) return value;
  if (value === VALIDATION_STATUS.PENDING) return VALIDATION_STATUS.PENDING;
  if (publie === true) return VALIDATION_STATUS.APPROVED;
  return VALIDATION_STATUS.PENDING;
}

async function ensureMemberProfile(user) {
  if (!user) return false;
  try {
    const ref = db.collection(COLLECTIONS.MEMBRES).doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        nom: user.displayName || user.email?.split('@')[0] || 'Membre',
        prenom: '',
        nomFamille: '',
        email: user.email || '',
        telephone: '',
        pays: '',
        secteur: '',
        statut: 'actif',
        codeEthique: true,
        role: ROLES.MEMBRE,
        publicProfileEnabled: true,
        showPhoto: true,
        showBio: true,
        showLocation: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Sync membre impossible:', error);
    return false;
  }
}

async function isCurrentUserAdmin(user) {
  if (!user) return false;
  try {
    const snap = await db.collection(COLLECTIONS.ADMINS).doc(user.uid).get();
    if (!snap.exists) return false;
    const data = snap.data() || {};
    return data.active !== false;
  } catch (error) {
    console.warn('Lecture admin impossible:', error);
    return false;
  }
}

function ensureAdminButtons() {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/admin/')) return;

  const adminHref = getAdminHref();
  const adminSpecs = [
    { container: '#navbar > div > div.hidden.lg\\:flex.gap-3', classes: 'auth-admin-link hidden btn btn-outline text-sm py-2 px-4', label: 'Dashboard' },
    { container: '#mobile-menu', classes: 'auth-admin-link hidden btn btn-outline text-center text-sm', label: 'Dashboard' }
  ];

  adminSpecs.forEach(({ container, classes, label }) => {
    const root = document.querySelector(container);
    if (!root) return;

    const existing = root.querySelector('.auth-admin-link');
    if (existing) {
      existing.href = adminHref;
      existing.textContent = label;
      return;
    }

    const refNode = root.querySelector('.auth-logout-link') || root.querySelector('.auth-chat-link') || root.querySelector('.auth-member-link') || root.querySelector('.auth-register-link');
    if (!refNode) return;

    const link = document.createElement('a');
    link.href = adminHref;
    link.className = classes;
    link.textContent = label;
    refNode.insertAdjacentElement('beforebegin', link);
  });
}

function ensureAuthLoginButtons() {
  const loginHref = getAuthLoginHref();
  const loginSpecs = [
    { container: '#navbar > div > div.hidden.lg\\:flex.gap-3', classes: 'auth-login-link hidden btn btn-outline text-sm py-2 px-4', label: 'Se connecter' },
    { container: '#mobile-menu', classes: 'auth-login-link hidden btn btn-outline text-center text-sm', label: 'Se connecter' }
  ];

  loginSpecs.forEach(({ container, classes, label }) => {
    const root = document.querySelector(container);
    if (!root) return;

    const existing = root.querySelector('.auth-login-link');
    if (existing) {
      existing.href = loginHref;
      existing.textContent = label;
      return;
    }

    const registerLink = root.querySelector('.auth-register-link');
    if (!registerLink) return;

    const link = document.createElement('a');
    link.href = loginHref;
    link.className = classes;
    link.textContent = label;
    registerLink.insertAdjacentElement('beforebegin', link);
  });
}

// ── Auth State Observer ───────────────────────────────────────
function initAuthState() {
  // Met à jour l'interface et les liens visibles selon l'état d'authentification
  ensureAuthLoginButtons();
  ensureAdminButtons();
  auth.onAuthStateChanged(async (user) => {
    const loginLinks  = document.querySelectorAll('.auth-login-link');
    const logoutLinks = document.querySelectorAll('.auth-logout-link');
    const memberLinks = document.querySelectorAll('.auth-member-link');
    const navbarMemberLinks = document.querySelectorAll('#navbar .auth-member-link');
    const chatLinks   = document.querySelectorAll('.auth-chat-link');
    const adminLinks  = document.querySelectorAll('.auth-admin-link');
    const registerLinks = document.querySelectorAll('.auth-register-link');
    const show = (links) => links.forEach(el => el.classList.remove('hidden'));
    const hide = (links) => links.forEach(el => el.classList.add('hidden'));
    const profileIconSvg = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 10-16 0" />
        <circle cx="12" cy="8" r="4" />
      </svg>
    `;
    const renderNavbarProfileIcon = (el) => {
      el.innerHTML = profileIconSvg;
      el.setAttribute('aria-label', 'Mon profil');
      el.setAttribute('title', 'Mon profil');
      el.classList.add('profile-icon-link');
    };

    const setVisitorView = () => {
      show(loginLinks);
      show(registerLinks);
      hide(memberLinks);
      hide(chatLinks);
      hide(adminLinks);
      hide(logoutLinks);
    };

    const setMemberView = () => {
      hide(loginLinks);
      hide(registerLinks);
      show(memberLinks);
      show(chatLinks);
      hide(adminLinks);
      show(logoutLinks);
    };

    if (!user) {
      setVisitorView();
      document.body.classList.remove('user-authenticated');
      return;
    }

    await ensureMemberProfile(user);
    const isAdmin = await isCurrentUserAdmin(user);

    // Utilisateur connecté : masquer immédiatement les liens de visiteur
    hide(loginLinks);
    hide(registerLinks);

    // Base : utilisateur connecté standard
    setMemberView();
    // Marque la page comme 'utilisateur connecté' pour afficher les sections réservées
    document.body.classList.add('user-authenticated');
    if (isAdmin) {
      show(adminLinks);
    }

    // Afficher le prénom dans "Mon profil"
    try {
      const membreDoc = await db.collection(COLLECTIONS.MEMBRES).doc(user.uid).get();
      const nomComplet = membreDoc.exists ? (membreDoc.data().nom || '').trim() : '';
      const prenom = nomComplet ? nomComplet.split(' ')[0] : '';
      navbarMemberLinks.forEach(renderNavbarProfileIcon);
      memberLinks.forEach(el => {
        if (!el.closest('#navbar')) {
          el.textContent = prenom ? `Profil (${prenom})` : 'Mon profil';
        }
      });
    } catch (e) {
      navbarMemberLinks.forEach(renderNavbarProfileIcon);
      memberLinks.forEach(el => {
        if (!el.closest('#navbar')) {
          el.textContent = 'Mon profil';
        }
      });
    }
  });
}

// ── Logout ───────────────────────────────────────────────────
function logout() {
  // Déconnecte l'utilisateur et redirige vers la page d'accueil
  auth.signOut().then(() => {
    showToast('Déconnexion réussie', 'success');
    setTimeout(() => window.location.href = getHomeHref(), 1000);
  });
}

function getHomeHref() {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/pages/')) return '../index.html';
  if (path.includes('/admin/')) return '../index.html';
  return 'index.html';
}

// ── Format Date FR ───────────────────────────────────────────
function formatDateFR(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Truncate Text ─────────────────────────────────────────────
function truncate(str, n) {
  return str && str.length > n ? str.substring(0, n) + '...' : str;
}

// ── Slugify ───────────────────────────────────────────────────
function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .trim();
}

// ── Image Upload Preview ──────────────────────────────────────
function previewImage(inputEl, imgEl) {
  inputEl.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { imgEl.src = ev.target.result; };
    reader.readAsDataURL(file);
  });
}

// ── Upload File to Firebase Storage ──────────────────────

// ── Responsive Helpers ────────────────────────────────────────
function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function isTablet() {
  return window.matchMedia('(min-width: 769px) and (max-width: 1024px)').matches;
}

function isDesktop() {
  return window.matchMedia('(min-width: 1025px)').matches;
}

function getDeviceType() {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
}

// ── Optimize Animations for Mobile ──────────────────────────
function initResponsiveAnimations() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobileDevice = isMobile();

  if (prefersReducedMotion || isMobileDevice) {
    document.documentElement.style.scrollBehavior = 'auto';
    document.querySelectorAll('[style*="animation"]').forEach(el => {
      el.style.animation = 'none';
    });
  }
}

// ── Debounce Helper ──────────────────────────────────────────
function debounce(func, delay = 300) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// ── Throttle Helper ──────────────────────────────────────────
function throttle(func, limit = 300) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ── Lazy Load Images ──────────────────────────────────────────
function initLazyLoad() {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '50px' });

    document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
  }
}

async function uploadFile(file, path) {
  // Upload un fichier image vers Cloudinary et retourne son URL publique (secure_url)
  if (!file) throw new Error('Aucun fichier sélectionné.');
  if (!CLOUDINARY) {
    throw new Error('Configuration Cloudinary manquante. Vérifiez js/firebase-config.js.');
  }

  if (!CLOUDINARY.UPLOAD_PRESET) {
    throw new Error('Cloudinary preset manquant. Vérifiez la valeur UPLOAD_PRESET dans js/firebase-config.js.');
  }

  if (!CLOUDINARY.UPLOAD_URL) {
    if (!CLOUDINARY.CLOUD_NAME) {
      throw new Error('URL Cloudinary manquante. Vérifiez CLOUDINARY.UPLOAD_URL ou CLOUDINARY.CLOUD_NAME dans js/firebase-config.js.');
    }
    CLOUDINARY.UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY.CLOUD_NAME}/image/upload`;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY.UPLOAD_PRESET);
  formData.append('resource_type', 'image');

  // Optionnel: ranger par "dossier logique" basé sur le path historique Firebase
  if (path) {
    const folder = String(path).replace(/\/+$/, '');
    if (folder) formData.append('folder', folder);
  }

  const response = await fetch(CLOUDINARY.UPLOAD_URL, {
    method: 'POST',
    body: formData
  });

  let data = null;
  let rawText = '';
  try {
    data = await response.json();
  } catch (jsonError) {
    rawText = await response.text().catch(() => 'Impossible de lire la réponse Cloudinary.');
    console.error('Cloudinary upload returned invalid JSON:', jsonError, 'raw response:', rawText);
  }

  if (!response.ok || !data?.secure_url) {
    console.error('Cloudinary upload failed response:', data || rawText, 'status:', response.status, response.statusText);
    const message = data?.error?.message || rawText || `Cloudinary upload échoué (${response.status} ${response.statusText}).`;
    const code = data?.error?.http_code ? ` (${data.error.http_code})` : '';
    const details = data?.error?.details ? ` — ${data.error.details}` : '';
    throw new Error(message + code + details);
  }

  return data.secure_url;
}

async function uploadIfNeeded(fileInput, existingUrl = '', folder = STORAGE_PATHS.GALERIE) {
  // Upload un fichier s'il est présent, sinon retourne l'URL existante
  const file = fileInput?.files?.[0];
  if (!file) return existingUrl || '';
  try {
    return await uploadFile(file, folder);
  } catch (error) {
    console.error('Erreur upload:', error);
    showToast('Erreur lors du téléchargement: ' + error.message, 'error');
    return existingUrl || '';
  }
}

// ── Counter Animation ─────────────────────────────────────────
function animateCounter(el, target, duration = 1500) {
  let start = 0;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    start += step;
    if (start >= target) { start = target; clearInterval(timer); }
    el.textContent = Math.floor(start).toLocaleString('fr-FR');
  }, 16);
}

// ── Init Global ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initMobileMenu();
  initScrollReveal();
  initAuthState();
});
