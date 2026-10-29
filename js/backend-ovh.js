// ============================================================
//  GREC — Client de l'API OVH (comptes + base de données)
//  Imite la partie de Firebase (v9 « compat ») utilisée par le site, pour que les pages
//  gardent exactement le même code : firebase.auth(), firebase.firestore(), FieldValue, Timestamp…
//  Les données vivent dans MySQL chez OVH (voir /api). Aucune dépendance externe.
// ============================================================
(function () {
  'use strict';

  var script = document.currentScript;
  var API = (function () {
    try { return new URL('../api/', script.src).pathname; } catch (e) { return '/api/'; }
  })();

  // ---------- Erreurs ----------
  function makeError(code, message) {
    var e = new Error(message || code);
    e.code = code;
    return e;
  }

  // ---------- Valeurs spéciales ----------
  function Timestamp(seconds, nanoseconds) { this.seconds = seconds; this.nanoseconds = nanoseconds || 0; }
  Timestamp.fromMillis = function (ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); };
  Timestamp.fromDate = function (d) { return Timestamp.fromMillis(d.getTime()); };
  Timestamp.now = function () { return Timestamp.fromMillis(Date.now()); };
  Timestamp.prototype.toMillis = function () { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); };
  Timestamp.prototype.toDate = function () { return new Date(this.toMillis()); };
  Timestamp.prototype.isEqual = function (o) { return !!o && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; };
  Timestamp.prototype.valueOf = function () { return String(this.toMillis()); };

  function FieldValue(kind) { this.kind = kind; }
  FieldValue.serverTimestamp = function () { return new FieldValue('serverTimestamp'); };

  function encode(v) {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (v instanceof FieldValue) return { __sv: true };
    if (v instanceof Timestamp) return { __ts: v.toMillis() };
    if (v instanceof Date) return { __ts: v.getTime() };
    if (Array.isArray(v)) return v.map(function (x) { var e = encode(x); return e === undefined ? null : e; });
    if (typeof v === 'object') {
      var out = {};
      Object.keys(v).forEach(function (k) { var e = encode(v[k]); if (e !== undefined) out[k] = e; });
      return out;
    }
    return v;
  }

  function decode(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(decode);
    var keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === '__ts') return Timestamp.fromMillis(v.__ts);
    var out = {};
    keys.forEach(function (k) { out[k] = decode(v[k]); });
    return out;
  }

  // ---------- Appels à l'API ----------
  var csrf = '';
  var csrfPromise = null;

  function refreshSession() {
    csrfPromise = fetch(API + 'auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { csrf = j.csrf || ''; return j; });
    return csrfPromise;
  }

  function call(route, body, retried) {
    var ready = csrf ? Promise.resolve() : (csrfPromise || refreshSession());
    return ready.then(function () {
      return fetch(API + route, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
        body: JSON.stringify(body || {})
      });
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (j && j.csrf) csrf = j.csrf;
        if (!res.ok) {
          var err = (j && j.error) || {};
          if (res.status === 403 && err.code === 'csrf' && !retried) {
            csrf = ''; csrfPromise = null;
            return call(route, body, true);
          }
          throw makeError(err.code || ('http-' + res.status), err.message || 'Erreur ' + res.status);
        }
        return j;
      });
    });
  }

  // ---------- Authentification ----------
  function User(raw) {
    this.uid = raw.uid; this.email = raw.email; this.displayName = raw.displayName || null;
    this.photoURL = raw.photoURL || null; this.emailVerified = !!raw.emailVerified;
    this.isAnonymous = false; this.providerData = [];
  }
  User.prototype.updateProfile = function (p) {
    var self = this; var body = {};
    if (p && 'displayName' in p) body.displayName = p.displayName || '';
    if (p && 'photoURL' in p) body.photoURL = p.photoURL || '';
    return call('auth/profile', body).then(function (j) { self.displayName = j.user.displayName || null; self.photoURL = j.user.photoURL || null; });
  };
  User.prototype.sendEmailVerification = function () { return call('auth/send-verification', {}).then(function () {}); };
  User.prototype.getIdToken = function () { return Promise.resolve('session'); };
  User.prototype.reload = function () { return Promise.resolve(); };

  function Auth() {
    var self = this;
    this.currentUser = null;
    this._listeners = [];
    this._ready = false;
    this._init = refreshSession().then(function (j) {
      self.currentUser = j.user ? new User(j.user) : null;
      self._ready = true;
      self._emit();
    }).catch(function () { self._ready = true; self._emit(); });
    // Synchronisation entre onglets (connexion / déconnexion dans un autre onglet)
    try {
      window.addEventListener('storage', function (e) {
        if (e.key === 'grec:auth:ping') {
          refreshSession().then(function (j) { self._set(j.user ? new User(j.user) : null); });
        }
      });
    } catch (e) { /* ignoré */ }
  }
  Auth.prototype._emit = function () {
    var u = this.currentUser;
    this._listeners.slice().forEach(function (cb) { try { cb(u); } catch (e) { console.error(e); } });
  };
  Auth.prototype._set = function (user) {
    var changed = (this.currentUser && this.currentUser.uid) !== (user && user.uid);
    this.currentUser = user;
    if (changed) this._emit();
  };
  Auth.prototype._ping = function () { try { localStorage.setItem('grec:auth:ping', String(Date.now())); } catch (e) { /* ignoré */ } };
  Auth.prototype.onAuthStateChanged = function (cb) {
    var self = this;
    this._listeners.push(cb);
    if (this._ready) setTimeout(function () { if (self._listeners.indexOf(cb) !== -1) cb(self.currentUser); }, 0);
    return function () { var i = self._listeners.indexOf(cb); if (i !== -1) self._listeners.splice(i, 1); };
  };
  Auth.prototype.signInWithEmailAndPassword = function (email, password) {
    var self = this;
    return call('auth/login', { email: email, password: password }).then(function (j) {
      var u = new User(j.user); self._set(u); self._ping(); return { user: u };
    });
  };
  Auth.prototype.createUserWithEmailAndPassword = function (email, password) {
    var self = this;
    return call('auth/register', { email: email, password: password }).then(function (j) {
      var u = new User(j.user); self._set(u); self._ping(); return { user: u };
    });
  };
  Auth.prototype.signOut = function () {
    var self = this;
    return call('auth/logout', {}).then(function () { self._set(null); self._ping(); });
  };
  Auth.prototype.sendPasswordResetEmail = function (email) { return call('auth/reset', { email: email }).then(function () {}); };
  Auth.prototype.confirmPasswordReset = function (token, password) { return call('auth/reset-confirm', { token: token, password: password }).then(function () {}); };

  // ---------- Base de données ----------
  function autoId() {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
    var a = new Uint8Array(20); (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 20; i++) s += chars.charAt(a[i] % 62);
    return s;
  }

  function DocumentSnapshot(ref, data, exists) { this.ref = ref; this.id = ref.id; this.exists = exists; this._data = data; }
  DocumentSnapshot.prototype.data = function () { return this.exists ? this._data : undefined; };
  DocumentSnapshot.prototype.get = function (field) { return this.exists && this._data ? this._data[field] : undefined; };

  function QuerySnapshot(docs) { this.docs = docs; this.size = docs.length; this.empty = docs.length === 0; }
  QuerySnapshot.prototype.forEach = function (fn) { this.docs.forEach(fn); };

  // Écoute « temps réel » par interrogations régulières (sans WebSocket : compatible hébergement mutualisé).
  function poll(fetcher, signature, onNext, onError) {
    var stopped = false, last = null, timer = null, failures = 0;
    function delay() { return (document.hidden ? 20000 : 4000) + Math.floor(Math.random() * 800); }
    function tick() {
      if (stopped) return;
      fetcher().then(function (snap) {
        if (stopped) return;
        failures = 0;
        var sig = signature(snap);
        if (sig !== last) { last = sig; onNext(snap); }
        timer = setTimeout(tick, delay());
      }).catch(function (err) {
        if (stopped) return;
        var fatal = err && (err.code === 'permission-denied' || err.code === 'bad-query' || err.code === 'failed-precondition');
        if (fatal || ++failures > 5) { stopped = true; if (onError) onError(err); return; }
        timer = setTimeout(tick, delay());
      });
    }
    tick();
    return function () { stopped = true; if (timer) clearTimeout(timer); };
  }

  function DocumentReference(fs, path) {
    this.firestore = fs; this.path = path;
    this.id = path.split('/').pop();
    var parts = path.split('/'); parts.pop();
    this.parentPath = parts.join('/');
  }
  DocumentReference.prototype.get = function () {
    var self = this;
    return call('db/get', { path: this.path }).then(function (j) { return new DocumentSnapshot(self, j.exists ? decode(j.data) : undefined, !!j.exists); });
  };
  DocumentReference.prototype.set = function (data, options) {
    return call('db/set', { path: this.path, data: encode(data), merge: !!(options && options.merge) }).then(function () {});
  };
  DocumentReference.prototype.update = function (data) {
    var self = this;
    return this.get().then(function (snap) {
      if (!snap.exists) throw makeError('not-found', 'No document to update: ' + self.path);
      return self.set(data, { merge: true });
    });
  };
  DocumentReference.prototype.delete = function () { return call('db/delete', { path: this.path }).then(function () {}); };
  DocumentReference.prototype.collection = function (name) { return new CollectionReference(this.firestore, this.path + '/' + name); };
  DocumentReference.prototype.onSnapshot = function (next, error) {
    var self = this;
    return poll(function () { return self.get(); }, function (s) { return s.exists ? JSON.stringify(s._data) : 'absent'; }, next, error);
  };

  function Query(fs, path, wheres, orders, lim) {
    this.firestore = fs; this.path = path; this._wheres = wheres || []; this._orders = orders || []; this._limit = lim || null;
  }
  Query.prototype._clone = function () { return new Query(this.firestore, this.path, this._wheres.slice(), this._orders.slice(), this._limit); };
  Query.prototype.where = function (field, op, value) { var q = this._clone(); q._wheres.push([field, op, encode(value)]); return q; };
  Query.prototype.orderBy = function (field, dir) { var q = this._clone(); q._orders.push([field, dir === 'desc' ? 'desc' : 'asc']); return q; };
  Query.prototype.limit = function (n) { var q = this._clone(); q._limit = n; return q; };
  Query.prototype.get = function () {
    var self = this;
    return call('db/query', { path: this.path, where: this._wheres, orderBy: this._orders, limit: this._limit }).then(function (j) {
      return new QuerySnapshot((j.docs || []).map(function (d) {
        return new DocumentSnapshot(new DocumentReference(self.firestore, self.path + '/' + d.id), decode(d.data), true);
      }));
    });
  };
  Query.prototype.onSnapshot = function (next, error) {
    var self = this;
    return poll(function () { return self.get(); }, function (s) { return JSON.stringify(s.docs.map(function (d) { return [d.id, d._data]; })); }, next, error);
  };

  function CollectionReference(fs, path) {
    Query.call(this, fs, path, [], [], null);
    this.id = path.split('/').pop();
  }
  CollectionReference.prototype = Object.create(Query.prototype);
  CollectionReference.prototype.constructor = CollectionReference;
  CollectionReference.prototype.doc = function (id) { return new DocumentReference(this.firestore, this.path + '/' + (id || autoId())); };
  CollectionReference.prototype.add = function (data) {
    var self = this;
    return call('db/add', { path: this.path, data: encode(data) }).then(function (j) { return new DocumentReference(self.firestore, self.path + '/' + j.id); });
  };

  function WriteBatch() { this._ops = []; }
  WriteBatch.prototype.set = function (ref, data, options) { this._ops.push({ type: 'set', path: ref.path, data: encode(data), merge: !!(options && options.merge) }); return this; };
  WriteBatch.prototype.update = function (ref, data) { this._ops.push({ type: 'set', path: ref.path, data: encode(data), merge: true }); return this; };
  WriteBatch.prototype.delete = function (ref) { this._ops.push({ type: 'delete', path: ref.path }); return this; };
  WriteBatch.prototype.commit = function () { return call('db/batch', { ops: this._ops }).then(function () {}); };

  function Firestore() {}
  Firestore.prototype.collection = function (path) { return new CollectionReference(this, path); };
  Firestore.prototype.doc = function (path) { return new DocumentReference(this, path); };
  Firestore.prototype.batch = function () { return new WriteBatch(); };
  Firestore.prototype.settings = function () {};
  Firestore.prototype.enablePersistence = function () { return Promise.resolve(); };

  // ---------- Façade « firebase » ----------
  var appOptions = null, authSingleton = null, fsSingleton = null;
  var firebase = {
    apps: [],
    initializeApp: function (options) {
      appOptions = Object.assign({}, options || {}, { projectId: 'grec-ovh' });
      var app = { name: '[DEFAULT]', options: appOptions };
      firebase.apps = [app];
      return app;
    },
    app: function () { return firebase.apps[0] || firebase.initializeApp({}); },
    auth: function () { if (!authSingleton) authSingleton = new Auth(); return authSingleton; },
    firestore: function () { if (!fsSingleton) fsSingleton = new Firestore(); return fsSingleton; },
    storage: undefined,
    backend: 'ovh'
  };
  firebase.firestore.FieldValue = FieldValue;
  firebase.firestore.Timestamp = Timestamp;
  window.firebase = firebase;
})();
