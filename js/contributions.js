// ============================================================
// GREC — Contributions membres (articles & événements)
// Utilisé sur la page Actualités pour les membres connectés
// ============================================================

const contributionState = {
  uid: null,
  authorName: 'Membre',
  bound: false,
  filterStatus: 'all'
};

// ── Utilitaires ──────────────────────────────────────────────
// formatDateFR() est fournie par utils.js

function getMemberDisplayName(memberData, user) {
  if (memberData?.nom) return memberData.nom;
  if (memberData?.name) return memberData.name;
  if (user?.displayName) return user.displayName;
  if (user?.email) return user.email.split('@')[0];
  return 'Membre';
}

function normalizeValidationStatus(status, publie) {
  if (publie) return VALIDATION_STATUS.APPROVED;
  if (status === VALIDATION_STATUS.REJECTED) return VALIDATION_STATUS.REJECTED;
  if (status === VALIDATION_STATUS.APPROVED) return VALIDATION_STATUS.APPROVED;
  return VALIDATION_STATUS.PENDING;
}

function getValidationLabel(status) {
  const labels = {
    'en_attente': '⏳ En attente',
    'valide': '✓ Validé',
    'refuse': '✕ Refusé'
  };
  return labels[status] || '? Inconnu';
}

function escapeContributionHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function switchContributionTab(type) {
  const isArticle = type === 'article';
  const articleTab = document.getElementById('contrib-tab-article');
  const eventTab = document.getElementById('contrib-tab-event');
  const articleForm = document.getElementById('contrib-article-form');
  const eventForm = document.getElementById('contrib-event-form');
  if (!articleTab || !eventTab || !articleForm || !eventForm) return;

  articleTab.classList.toggle('active', isArticle);
  articleTab.classList.toggle('btn-gold', isArticle);
  articleTab.classList.toggle('btn-outline', !isArticle);
  eventTab.classList.toggle('active', !isArticle);
  eventTab.classList.toggle('btn-gold', !isArticle);
  eventTab.classList.toggle('btn-outline', isArticle);
  articleForm.classList.toggle('hidden', !isArticle);
  eventForm.classList.toggle('hidden', isArticle);
}

function renderContributionItem(item, type) {
  const status = normalizeValidationStatus(item.validationStatus, item.publie);
  const statusClass = `contribution-status-${status}`;
  const subtitle = type === 'article'
    ? (item.resume || '')
    : `${item.lieu || '-'} · ${formatDateFR(item.date)}`;
  const canDelete = status === VALIDATION_STATUS.PENDING;
  const rejection = status === VALIDATION_STATUS.REJECTED && item.rejectionReason;

  const statusHint = status === VALIDATION_STATUS.PENDING
    ? 'En cours de validation par l\'administrateur.'
    : status === VALIDATION_STATUS.APPROVED
      ? 'Validé et publié sur le site.'
      : 'Refusé par l\'administrateur.';

  return `
    <article class="rounded-2xl border border-slate-200 bg-white/90 p-4">
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <span class="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-700">${type === 'article' ? 'Article' : 'Événement'}</span>
        <span class="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusClass}">${getValidationLabel(status)}</span>
      </div>
      <div class="font-semibold text-navy">${escapeContributionHtml(item.titre || 'Sans titre')}</div>
      <p class="text-sm text-slate-500 mt-2">${escapeContributionHtml(subtitle)}</p>
      <p class="text-xs text-slate-400 mt-2">${statusHint}</p>
      ${rejection ? `<p class="text-sm text-red-600 mt-2">Motif du refus : ${escapeContributionHtml(item.rejectionReason)}</p>` : ''}
      ${canDelete ? `<button type="button" data-action="delete-contribution" data-type="${type}" data-id="${item.id}" class="mt-3 text-sm text-red-600 border border-red-100 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors">Supprimer</button>` : ''}
    </article>
  `;
}

async function loadContributions(uid) {
  const listEl = document.getElementById('contrib-list');
  const countEl = document.getElementById('contrib-count');
  if (!listEl || !countEl || !uid) return;

  let items = [];
  try {
    const snap = await db.collection(COLLECTIONS.CONTRIBUTIONS).where('authorUid', '==', uid).get();
    items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items.sort((a, b) => {
      const av = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime() || 0;
      const bv = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime() || 0;
      return bv - av;
    });
  } catch (err) {
    console.error('loadContributions failed:', err);
    listEl.innerHTML = '<p class="text-sm text-red-600 rounded-2xl border border-dashed border-red-200 p-4">Impossible de charger vos contributions.</p>';
    return;
  }

  updateContributionSummary(items);

  const filteredItems = contributionState.filterStatus === 'all'
    ? items
    : items.filter(item => normalizeValidationStatus(item.validationStatus, item.publie) === contributionState.filterStatus);

  countEl.textContent = `${filteredItems.length} contribution${filteredItems.length > 1 ? 's' : ''}`;

  if (!items.length) {
    listEl.innerHTML = '<p class="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 p-4">Tu n\'as encore proposé aucun article ou événement.</p>';
    return;
  }

  if (!filteredItems.length) {
    listEl.innerHTML = '<p class="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 p-4">Aucune contribution ne correspond au filtre sélectionné.</p>';
    return;
  }

  listEl.innerHTML = filteredItems.map(item => renderContributionItem(item, item.type)).join('');
  listEl.querySelectorAll('[data-action="delete-contribution"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer cette contribution en attente ?')) return;
      await db.collection(COLLECTIONS.CONTRIBUTIONS).doc(btn.dataset.id).delete();
      showToast('Contribution supprimée.', 'success');
      await loadContributions(uid);
    });
  });
}

function updateContributionSummary(items) {
  const total = items.length;
  const pending = items.filter(item => normalizeValidationStatus(item.validationStatus, item.publie) === VALIDATION_STATUS.PENDING).length;
  const approved = items.filter(item => normalizeValidationStatus(item.validationStatus, item.publie) === VALIDATION_STATUS.APPROVED).length;
  const rejected = items.filter(item => normalizeValidationStatus(item.validationStatus, item.publie) === VALIDATION_STATUS.REJECTED).length;

  const totalEl = document.getElementById('contrib-summary-total');
  const pendingEl = document.getElementById('contrib-summary-pending');
  const approvedEl = document.getElementById('contrib-summary-approved');
  const rejectedEl = document.getElementById('contrib-summary-rejected');

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (approvedEl) approvedEl.textContent = approved;
  if (rejectedEl) rejectedEl.textContent = rejected;
}

function setContributionFilter(status) {
  contributionState.filterStatus = status;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  if (contributionState.uid) {
    loadContributions(contributionState.uid);
  }
}

async function uploadContributionImage(fileInput, urlInput, folder) {
  const file = fileInput?.files?.[0];
  const fallbackUrl = (urlInput?.value || '').trim();
  if (file) {
    try {
      return await uploadFile(file, folder);
    } catch (error) {
      console.warn('Contribution image upload failed, falling back to URL:', error);
      if (fallbackUrl) {
        showToast("L'image a été gardée via l'URL car l'upload a échoué.", 'error');
        return fallbackUrl;
      }
      showToast("L'upload de l'image a échoué, la contribution sera envoyée sans image.", 'error');
      return '';
    }
  }
  return fallbackUrl;
}

async function submitArticleContribution(e) {
  e.preventDefault();
  if (!contributionState.uid) return;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi en cours...';

  try {
    const imageURL = await uploadContributionImage(
      document.getElementById('contrib-article-image-file'),
      document.getElementById('contrib-article-image-url'),
      STORAGE_PATHS.ACTUALITES
    );
    await db.collection(COLLECTIONS.CONTRIBUTIONS).add({
      type: 'article',
      titre: document.getElementById('contrib-article-title').value.trim(),
      resume: document.getElementById('contrib-article-resume').value.trim(),
      contenu: document.getElementById('contrib-article-content').value.trim(),
      imageURL,
      image: imageURL,
      publie: false,
      validationStatus: VALIDATION_STATUS.PENDING,
      authorUid: contributionState.uid,
      authorName: contributionState.authorName,
      authorEmail: auth.currentUser?.email || '',
      auteur: contributionState.authorName,
      categorie: document.getElementById('contrib-article-category')?.value || 'actualite',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    e.target.reset();
    showToast('Article envoyé pour validation.', 'success');
    await loadContributions(contributionState.uid);
  } catch (err) {
    showToast(err.message || 'Envoi impossible.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer pour validation';
  }
}

async function submitEventContribution(e) {
  e.preventDefault();
  if (!contributionState.uid) return;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi en cours...';

  try {
    await db.collection(COLLECTIONS.CONTRIBUTIONS).add({
      type: 'event',
      titre: document.getElementById('contrib-event-title').value.trim(),
      date: document.getElementById('contrib-event-date').value,
      lieu: document.getElementById('contrib-event-location').value.trim(),
      description: document.getElementById('contrib-event-description').value.trim(),
      imageURL: document.getElementById('contrib-event-image-url').value.trim(),
      publie: false,
      validationStatus: VALIDATION_STATUS.PENDING,
      authorUid: contributionState.uid,
      authorName: contributionState.authorName,
      authorEmail: auth.currentUser?.email || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    e.target.reset();
    showToast('Événement envoyé pour validation.', 'success');
    await loadContributions(contributionState.uid);
  } catch (err) {
    showToast(err.message || 'Envoi impossible.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer pour validation';
  }
}

function bindContributionEvents() {
  if (contributionState.bound) return;
  contributionState.bound = true;

  document.getElementById('contrib-tab-article')?.addEventListener('click', () => switchContributionTab('article'));
  document.getElementById('contrib-tab-event')?.addEventListener('click', () => switchContributionTab('event'));
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setContributionFilter(btn.dataset.status));
  });
}

async function initContributions(user, memberData = {}) {
  const section = document.getElementById('contributions-section');
  if (!section || !user) return;

  contributionState.uid = user.uid;
  contributionState.authorName = getMemberDisplayName(memberData, user);
  section.classList.remove('hidden');
  document.getElementById('cta-guest')?.classList.add('hidden');
  document.getElementById('cta-member')?.classList.remove('hidden');
  bindContributionEvents();
  await loadContributions(user.uid);
}

function hideContributionsSection() {
  const section = document.getElementById('contributions-section');
  if (section) section.classList.add('hidden');
  document.getElementById('cta-guest')?.classList.remove('hidden');
  document.getElementById('cta-member')?.classList.add('hidden');
  contributionState.uid = null;
}
