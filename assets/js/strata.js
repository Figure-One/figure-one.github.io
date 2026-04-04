// === STRATA.JS — CORE ORCHESTRATOR ===

const StrataOS = (() => {

  let _users = [];
  let _sites = [];
  let _theme = 'dark';

  // ── Init ───────────────────────────────────────────────────────────────

  async function init() {
    document.body.classList.add('dark-mode');

    _users = window.STRATA_USERS || [];
    _sites = window.STRATA_SITES || [];

    if (_users.length === 0) {
      console.error('STRATA: No users found in window.STRATA_USERS. Check Jekyll _data/users.yml and that the page has front matter (--- ---) so Jekyll processes the template.');
    }

    startStatusClock();
    await runBootScreen();

    // If a persisted session exists, skip auth and go straight to desktop
    if (Auth.getUser()) {
      Desktop.launch();
      return;
    }

    showTerminal();
    Terminal.init('terminal-output', 'terminal-input', 'terminal-prompt');
    Terminal.runBoot();
  }

  // ── Boot screen animation ──────────────────────────────────────────────

  function runBootScreen() {
    return new Promise(resolve => {
      const screen = document.getElementById('boot-screen');
      const fill   = document.getElementById('boot-fill');
      const status = document.getElementById('boot-status-text');

      const steps = [
        'Initialising hardware abstraction…',
        'Loading Bedrock layer…',
        'Verifying cryptographic signatures…',
        'Starting STRATA kernel…',
        'Mounting secure environment…',
        'Ready.',
      ];

      let i = 0;
      const interval = setInterval(() => {
        if (i < steps.length) {
          status.textContent = steps[i];
          fill.style.width = ((i + 1) / steps.length * 100) + '%';
          i++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            screen.classList.add('fade-out');
            setTimeout(resolve, 1000);
          }, 600);
        }
      }, 340);
    });
  }

  // ── Status bar clock ───────────────────────────────────────────────────

  function startStatusClock() {
    function tick() {
      const now = new Date();
      const el = document.getElementById('clock');
      if (el) el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    tick();
    setInterval(tick, 1000);
  }

  // ── Views ──────────────────────────────────────────────────────────────

  function showTerminal() {
    document.getElementById('terminal-view').style.display = 'flex';
    document.getElementById('desktop-view').style.display  = 'none';
  }

  // ── Toast notifications ────────────────────────────────────────────────

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast${type ? ' ' + type : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ── Theme ──────────────────────────────────────────────────────────────

  function setTheme(t) {
    _theme = t;
    if (t === 'dark') document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
  }

  // ── Accessors ──────────────────────────────────────────────────────────

  function getUsers() { return _users; }
  function getSites() { return _sites; }

  return { init, getUsers, getSites, showToast, setTheme };

})();

document.addEventListener('DOMContentLoaded', () => StrataOS.init());
