// === AUTH.JS — STRATA OS AUTHENTICATION MODULE ===

const Auth = (() => {

  // Session state
  let currentUser = null; // never pre-loaded from localStorage here — validated in init()
  let loginAttempts = {}; // uid -> array of unique passwords tried (used when password is null)
  let loginPhase = 'card'; // 'card' | 'password' | 'passphrase'
  let selectedCard = null;
  let onLoginSuccess = null;

  // Per-uid random failure thresholds — only used when user has no defined password (null)
  const loginThresholds = {};

  // ── Password checking ───────────────────────────────────────────────────
  // If the user record has a defined, non-null password field, require exact
  // match (case-insensitive trim).  Otherwise fall back to the random-threshold
  // "try enough unique passwords" system.

  function checkPassword(uid, input, definedPassword) {
    const trimmed = input.trim();

    if (definedPassword !== null && definedPassword !== undefined && definedPassword !== '') {
      // Defined password: exact match required (case-insensitive)
      return trimmed.toLowerCase() === String(definedPassword).toLowerCase();
    }

    // No defined password: count unique attempts against a random threshold
    if (!loginAttempts[uid]) loginAttempts[uid] = [];
    if (loginThresholds[uid] === undefined) {
      loginThresholds[uid] = Math.floor(Math.random() * 4); // 0, 1, 2, or 3
    }
    const attempts = loginAttempts[uid];
    const alreadyTried = attempts.includes(trimmed.toLowerCase());
    if (alreadyTried) return false;
    attempts.push(trimmed.toLowerCase());
    return attempts.length > loginThresholds[uid];
  }

  function checkPassphrase(uid, input, definedPassphrase) {
    const trimmed = input.trim();

    if (definedPassphrase !== null && definedPassphrase !== undefined && definedPassphrase !== '') {
      return trimmed.toLowerCase() === String(definedPassphrase).toLowerCase();
    }

    // No defined passphrase: accept anything non-empty
    return trimmed.length > 0;
  }

  function resetAttempts(uid) {
    loginAttempts[uid] = [];
    delete loginThresholds[uid];
  }

  // ── Clearance level colours ─────────────────────────────────────────────
  const CL_COLORS = {
    0: '#777777', 1: '#009f6b', 2: '#0087bd',
    3: '#ffd300', 4: '#ff6d00', 5: '#c40233', 6: '#0c0c0c'
  };
  const CL_LABELS = {
    0: 'NO ACCESS', 1: 'UNRESTRICTED', 2: 'RESTRICTED',
    3: 'CONFIDENTIAL', 4: 'SECRET', 5: 'TOP SECRET', 6: 'COSMIC TOP SECRET'
  };

  // ── Session restore ─────────────────────────────────────────────────────
  // Called by StrataOS.init() to try resuming a persisted session.
  // Returns the user object if valid (clearance >= 1), null otherwise.
  function tryResumeSession() {
    try {
      const stored = JSON.parse(localStorage.getItem('strata_user') || 'null');
      if (!stored) return null;

      // Reject CL0 — they have no access and must not bypass to desktop
      if (!stored.clearance || stored.clearance < 1) {
        localStorage.removeItem('strata_user');
        return null;
      }

      currentUser = stored;
      return currentUser;
    } catch(e) {
      localStorage.removeItem('strata_user');
      return null;
    }
  }

  // ── Card UI ─────────────────────────────────────────────────────────────

  function buildCardHTML(user, index) {
    const color = CL_COLORS[user.clearance] || '#777';
    const label = CL_LABELS[user.clearance] || 'UNKNOWN';
    const isCL0 = user.clearance === 0;
    const textColor = user.clearance === 3 ? '#000' : (user.clearance === 6 ? '#555' : '#fff');
    return `
      <div class="id-card${isCL0 ? ' cl0-card' : ''}" data-index="${index}"
           style="border-color:${color}; box-shadow: 0 0 12px ${color}44, 0 0 4px ${color}66;${isCL0 ? 'opacity:0.5;cursor:not-allowed;' : ''}"
           ${isCL0 ? '' : `onclick="Auth.selectCard(${index})"`}>
        <div class="id-card-stripe" style="background:${color}; box-shadow: 0 0 8px ${color};"></div>
        <div class="id-card-body">
          <div>
            <div class="id-card-uid">${user.uid}</div>
            <div class="id-card-level-badge">
              <div class="id-card-level-dot" style="background:${color}; box-shadow:0 0 6px ${color};"></div>
              <span class="id-card-level-text" style="color:${color};">LVL ${user.clearance} — ${label}</span>
            </div>
          </div>
          <div class="id-card-footer">
            <span class="id-card-classification">${isCL0 ? 'NO SYSTEM ACCESS' : 'FOUNDATION PERSONNEL'}</span>
            <span class="id-card-logo">STRATA</span>
          </div>
        </div>
      </div>`;
  }

  function showCardModal(users, callback) {
    onLoginSuccess = callback;
    const modal      = document.getElementById('card-modal');
    const grid       = document.getElementById('cards-grid');
    const scannerText = document.getElementById('scanner-text');

    const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
    scannerText.textContent = isMobile
      ? 'PRESENT CARD TO FRONT OF DEVICE'
      : 'PRESENT KEYCARD TO CONTACTLESS READER';

    grid.innerHTML = users.map((u, i) => buildCardHTML(u, i)).join('');
    modal.classList.add('visible');

    const closeBtn = document.getElementById('card-modal-close');

    if (closeBtn) {
      const freshBtn = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(freshBtn, closeBtn);
      freshBtn.addEventListener('click', () => {
        modal.classList.remove('visible');
        Terminal.unlockInput();
        Terminal.printLine('Keycard not found. Press <span class="t-system">ENTER</span> to try again.', 't-muted');
        Terminal.setPendingCardLogin(true);
        document.getElementById('terminal-input')?.focus();
      });
    }
  }

  function hideCardModal() {
    document.getElementById('card-modal').classList.remove('visible');
  }

  function selectCard(index) {
    const users = StrataOS.getUsers();
    const user  = users[index];

    // CL0: denied at card selection — should never fire since onclick is removed,
    // but guard here anyway
    if (!user || user.clearance < 1) {
      return;
    }

    selectedCard = user;
    loginPhase   = 'password';
    hideCardModal();
    showLoginPanel(user, 'password');
  }

  // ── Login panel ─────────────────────────────────────────────────────────

  function showLoginPanel(user, phase) {
    const overlay = document.getElementById('login-overlay');
    const panel   = document.getElementById('login-panel');
    loginPhase    = phase;

    const hasDefinedPassword   = user.password   !== null && user.password   !== undefined && user.password   !== '';
    const hasDefinedPassphrase = user.passphrase  !== null && user.passphrase  !== undefined && user.passphrase  !== '';

    const stepDots = phase === 'password'
      ? `<div class="step-dot active"></div><div class="step-dot"></div>`
      : `<div class="step-dot done"></div><div class="step-dot active"></div>`;

    const fieldLabel = phase === 'password' ? 'ACCESS PASSWORD' : 'SECURITY PASSPHRASE';

    const fieldHint = phase === 'passphrase'
      ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">
           ${hasDefinedPassphrase ? 'Enter your security passphrase.' : 'Enter your assigned security passphrase sentence.'}
         </span>`
      : (hasDefinedPassword
          ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">Password required.</span>`
          : '');

    panel.innerHTML = `
      <div class="login-uid">${user.uid}</div>
      <div class="login-name">${user.title} ${user.name}</div>
      <div class="login-role">${user.role} &nbsp;·&nbsp; CLEARANCE ${user.clearance}</div>
      <div class="login-step-indicator">${stepDots}</div>
      <label class="login-field-label">${fieldLabel}</label>
      ${fieldHint}
      <input
        class="login-input" id="login-field"
        type="password"
        autocomplete="off" spellcheck="false"
        placeholder="${phase === 'password' ? '••••••••' : 'Enter passphrase…'}"
        onkeydown="if(event.key==='Enter') Auth.submitLoginField()"
      />
      <button class="login-submit" onclick="Auth.submitLoginField()">
        AUTHENTICATE &nbsp;▶
      </button>
      <div class="login-error" id="login-error"></div>
      <div style="margin-top:16px;">
        <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);cursor:pointer;"
          onclick="Auth.cancelLogin()">← BACK TO CARD SELECTION</span>
      </div>`;

    overlay.classList.add('visible');
    setTimeout(() => document.getElementById('login-field')?.focus(), 100);
  }

  function hideLoginPanel() {
    document.getElementById('login-overlay').classList.remove('visible');
  }

  function cancelLogin() {
    hideLoginPanel();
    selectedCard = null;
    loginPhase   = 'card';
    const users  = StrataOS.getUsers();
    showCardModal(users, onLoginSuccess);
  }

  async function submitLoginField() {
    const input = document.getElementById('login-field').value;
    const errEl = document.getElementById('login-error');

    if (!input.trim()) {
      errEl.textContent = '[ INPUT REQUIRED ]';
      return;
    }

    if (loginPhase === 'password') {
      errEl.textContent = '';
      await simulateAuthCheck();

      const pass = checkPassword(
        selectedCard.uid,
        input,
        selectedCard.password ?? null
      );

      if (!pass) {
        errEl.textContent = '[ AUTHENTICATION FAILED — INVALID CREDENTIALS ]';
        document.getElementById('login-field').value = '';
        document.getElementById('login-field').focus();
        // Shake animation
        const p = document.getElementById('login-panel');
        p.style.animation = 'none';
        void p.offsetWidth;
        p.style.animation = 'loginShake 0.3s ease';
      } else {
        loginPhase = 'passphrase';
        showLoginPanel(selectedCard, 'passphrase');
      }

    } else if (loginPhase === 'passphrase') {
      errEl.textContent = '';
      await simulateAuthCheck(true);

      const pass = checkPassphrase(
        selectedCard.uid,
        input,
        selectedCard.passphrase ?? null
      );

      if (!pass) {
        errEl.textContent = '[ AUTHENTICATION FAILED — INVALID PASSPHRASE ]';
        document.getElementById('login-field').value = '';
        document.getElementById('login-field').focus();
        const p = document.getElementById('login-panel');
        p.style.animation = 'none';
        void p.offsetWidth;
        p.style.animation = 'loginShake 0.3s ease';
      } else {
        finaliseLogin(selectedCard);
      }
    }
  }

  function simulateAuthCheck(longer = false) {
    return new Promise(resolve => {
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.textContent = '[ VERIFYING CREDENTIALS… ]';
      const delay = longer
        ? 1200 + Math.random() * 800
        : 600  + Math.random() * 600;
      setTimeout(resolve, delay);
    });
  }

  // ── Finalise login ──────────────────────────────────────────────────────

  async function finaliseLogin(user) {
    hideLoginPanel();

    // Double-check clearance before committing the session
    if (!user || user.clearance < 1) {
      // CL0 or invalid — show denial and return to card screen
      const modal = document.getElementById('card-modal');
      const inner = modal.querySelector('.card-modal-inner');
      if (inner) {
        const notice = document.createElement('div');
        notice.style.cssText = 'font-family:var(--font-mono);font-size:11px;color:var(--danger);margin-top:16px;';
        notice.textContent   = '[ ACCESS DENIED — CLEARANCE LEVEL 0 GRANTS NO SYSTEM ACCESS ]';
        inner.appendChild(notice);
        setTimeout(() => notice.remove(), 4000);
      }
      modal.classList.add('visible');
      return;
    }

    currentUser = { ...user };
    localStorage.setItem('strata_user', JSON.stringify(currentUser));
    resetAttempts(user.uid);

    const tethered = await resolveTetheredSite();
    currentUser.tetheredSite = tethered;

    if (onLoginSuccess) onLoginSuccess(currentUser);
  }

  // ── Geolocation / site tethering ────────────────────────────────────────

  function haversine(lat1, lon1, lat2, lon2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat/2)**2 +
                 Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async function resolveTetheredSite() {
    const sites = StrataOS.getSites();
    if (!sites || sites.length === 0) return null;

    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude } = pos.coords;
          let nearest = null, minDist = Infinity;
          for (const site of sites) {
            const d = haversine(latitude, longitude, site.lat, site.lon);
            if (d < minDist) { minDist = d; nearest = site; }
          }
          resolve(nearest);
        },
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  }

  // ── Logout ──────────────────────────────────────────────────────────────

  function logout() {
    currentUser  = null;
    loginAttempts = {};
    selectedCard  = null;
    loginPhase    = 'card';
    sessionStorage.clear();
    localStorage.removeItem('strata_user');
    location.reload();
  }

  // ── Accessors ───────────────────────────────────────────────────────────

  function getUser()          { return currentUser; }
  function hasScope(scope)    {
    if (!currentUser) return false;
    if (currentUser.scopes.includes('SITEAUTHORITY')) return true;
    return currentUser.scopes.includes(scope);
  }
  function hasClearance(level) {
    if (!currentUser) return false;
    return currentUser.clearance >= level;
  }

  return {
    tryResumeSession,
    showCardModal,
    selectCard,
    cancelLogin,
    submitLoginField,
    logout,
    getUser,
    hasScope,
    hasClearance,
    CL_COLORS,
    CL_LABELS
  };

})();

// CSS for login shake animation
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes loginShake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}
    60%{transform:translateX(-6px)}
    80%{transform:translateX(4px)}
  }
`;
document.head.appendChild(shakeStyle);