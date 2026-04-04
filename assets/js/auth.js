// === AUTH.JS — STRATA OS AUTHENTICATION MODULE ===

const Auth = (() => {

  // Session state
  let currentUser = null;
  let loginAttempts = {}; // uid -> array of unique passwords tried
  let loginPhase = 'card'; // 'card' | 'password' | 'passphrase'
  let selectedCard = null;
  let onLoginSuccess = null;

  // Password logic: track unique attempts per uid
  // First 1-3 unique fail; repeat of known-tried always fails; 4th+ unique succeeds
  function checkPassword(uid, input) {
    if (!loginAttempts[uid]) loginAttempts[uid] = [];
    const attempts = loginAttempts[uid];
    const alreadyTried = attempts.includes(input.trim().toLowerCase());
    if (alreadyTried) return false;
    attempts.push(input.trim().toLowerCase());
    if (attempts.length <= 3) return false;
    return true;
  }

  function resetAttempts(uid) {
    loginAttempts[uid] = [];
  }

  // Clearance level colours
  const CL_COLORS = {
    0: '#777777', 1: '#009f6b', 2: '#0087bd',
    3: '#ffd300', 4: '#ff6d00', 5: '#c40233', 6: '#0c0c0c'
  };
  const CL_LABELS = {
    0: 'NO ACCESS', 1: 'UNRESTRICTED', 2: 'RESTRICTED',
    3: 'CONFIDENTIAL', 4: 'SECRET', 5: 'TOP SECRET', 6: 'COSMIC TOP SECRET'
  };

  // Build card HTML for modal
  function buildCardHTML(user, index) {
    const color = CL_COLORS[user.clearance] || '#777';
    const label = CL_LABELS[user.clearance] || 'UNKNOWN';
    const textColor = user.clearance === 3 ? '#000' : (user.clearance === 6 ? '#555' : '#fff');
    return `
      <div class="id-card" data-index="${index}"
           style="border-color:${color}; box-shadow: 0 0 12px ${color}44, 0 0 4px ${color}66;"
           onclick="Auth.selectCard(${index})">
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
            <span class="id-card-classification">FOUNDATION PERSONNEL</span>
            <span class="id-card-logo">STRATA</span>
          </div>
        </div>
      </div>`;
  }

  // Render card selection modal
  function showCardModal(users, callback) {
    onLoginSuccess = callback;
    const modal = document.getElementById('card-modal');
    const grid = document.getElementById('cards-grid');
    const scannerText = document.getElementById('scanner-text');

    // Mobile vs desktop scanner prompt
    const isMobile = window.innerWidth <= 768 || /Mobi|Android/i.test(navigator.userAgent);
    scannerText.textContent = isMobile
      ? 'PRESENT CARD TO FRONT OF DEVICE'
      : 'PRESENT KEYCARD TO CONTACTLESS READER';

    grid.innerHTML = users.map((u, i) => buildCardHTML(u, i)).join('');
    modal.classList.add('visible');
  }

  function hideCardModal() {
    document.getElementById('card-modal').classList.remove('visible');
  }

  function selectCard(index) {
    const users = StrataOS.getUsers();
    selectedCard = users[index];
    loginPhase = 'password';
    hideCardModal();
    showLoginPanel(selectedCard, 'password');
  }

  // Login panel (password then passphrase)
  function showLoginPanel(user, phase) {
    const overlay = document.getElementById('login-overlay');
    const panel = document.getElementById('login-panel');
    loginPhase = phase;

    const stepDots = phase === 'password'
      ? `<div class="step-dot active"></div><div class="step-dot"></div>`
      : `<div class="step-dot done"></div><div class="step-dot active"></div>`;

    const fieldLabel = phase === 'password'
      ? 'ACCESS PASSWORD'
      : 'SECURITY PASSPHRASE';

    const fieldHint = phase === 'password'
      ? ''
      : '<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">Enter your assigned security passphrase sentence</span>';

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
    const users = StrataOS.getUsers();
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
      // Simulate auth check delay
      errEl.textContent = '';
      await simulateAuthCheck();

      const pass = checkPassword(selectedCard.uid, input);
      if (!pass) {
        errEl.textContent = '[ AUTHENTICATION FAILED — INVALID CREDENTIALS ]';
        document.getElementById('login-field').value = '';
        document.getElementById('login-field').focus();
        // Shake animation
        document.getElementById('login-panel').style.animation = 'none';
        void document.getElementById('login-panel').offsetWidth;
        document.getElementById('login-panel').style.animation = 'loginShake 0.3s ease';
      } else {
        loginPhase = 'passphrase';
        showLoginPanel(selectedCard, 'passphrase');
      }
    } else if (loginPhase === 'passphrase') {
      // Passphrase: accept anything
      errEl.textContent = '';
      await simulateAuthCheck(true);
      finaliseLogin(selectedCard);
    }
  }

  function simulateAuthCheck(longer = false) {
    return new Promise(resolve => {
      const errEl = document.getElementById('login-error');
      if (errEl) errEl.textContent = '[ VERIFYING CREDENTIALS… ]';
      const delay = longer
        ? 1200 + Math.random() * 800
        : 600 + Math.random() * 600;
      setTimeout(resolve, delay);
    });
  }

  // Complete login — get geolocation then fire callback
  async function finaliseLogin(user) {
    hideLoginPanel();
    currentUser = { ...user };
    resetAttempts(user.uid);

    // Geolocation → nearest site
    const tethered = await resolveTetheredSite();
    currentUser.tetheredSite = tethered;

    if (onLoginSuccess) onLoginSuccess(currentUser);
  }

  // Haversine distance between two lat/lon points (km)
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async function resolveTetheredSite() {
    const sites = StrataOS.getSites();
    if (!sites || sites.length === 0) return null;

    return new Promise(resolve => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
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

  function logout() {
    currentUser = null;
    loginAttempts = {};
    selectedCard = null;
    loginPhase = 'card';
    // Session storage wipe
    sessionStorage.clear();
    // Reload page for clean session
    location.reload();
  }

  function getUser() { return currentUser; }

  function hasScope(scope) {
    if (!currentUser) return false;
    if (currentUser.scopes.includes('SITEAUTHORITY')) return true;
    return currentUser.scopes.includes(scope);
  }

  function hasClearance(level) {
    if (!currentUser) return false;
    return currentUser.clearance >= level;
  }

  return {
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

// CSS for login shake
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
