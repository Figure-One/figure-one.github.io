// === DESKTOP.JS — STRATA OS GRAPHICAL ENVIRONMENT ===

const Desktop = (() => {

  let launched = false;
  let windows = {};
  let zCounter = 10;
  let activeWinId = null;
  let clockInterval = null;

  // ── Launch desktop ──────────────────────────────────────────────────────

  function launch() {
    if (launched) return;
    launched = true;

    const terminalView = document.getElementById('terminal-view');
    const desktopView  = document.getElementById('desktop-view');
    terminalView.style.display = 'none';
    desktopView.style.display  = 'flex';

    buildCircuitLines();
    startClock();
    updateTopbarUser();

    // Spawn welcome notification
    setTimeout(() => {
      const user = Auth.getUser();
      StrataOS.showToast(`Welcome, ${user.title} ${user.name}`, 'success');
    }, 500);
  }

  // ── Topbar ──────────────────────────────────────────────────────────────

  function updateTopbarUser() {
    const user = Auth.getUser();
    if (!user) return;
    const el = document.getElementById('topbar-user');
    if (el) el.textContent = `${user.uid} — ${user.role} — CL${user.clearance}`;
  }

  function startClock() {
    function tick() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
      const el1 = document.getElementById('topbar-clock');
      const el2 = document.getElementById('status-clock');
      if (el1) el1.textContent = `${dateStr}  ${timeStr}`;
      if (el2) el2.textContent = timeStr;
    }
    tick();
    clockInterval = setInterval(tick, 1000);
  }

  // ── Circuit line decoration ─────────────────────────────────────────────

  function buildCircuitLines() {
    const bg = document.getElementById('desktop-bg');
    if (!bg) return;
    const lines = [
      { top:'15%', left:0, width:'30%', height:'2px' },
      { top:'40%', right:0, width:'20%', height:'2px' },
      { top:0, left:'60%', width:'2px', height:'25%' },
      { bottom:'20%', left:'80%', width:'2px', height:'30%' },
      { top:'70%', left:'10%', width:'15%', height:'2px' },
    ];
    lines.forEach(l => {
      const el = document.createElement('div');
      el.className = 'circuit-line';
      Object.assign(el.style, l);
      bg.appendChild(el);
    });
  }

  // ── Window management ───────────────────────────────────────────────────

  function createWindow(id, title, contentFn, opts = {}) {
    if (windows[id]) {
      focusWindow(id);
      if (windows[id].minimised) restoreWindow(id);
      return;
    }

    const container = document.getElementById('windows-container');
    const win = document.createElement('div');
    win.className = 'app-window';
    win.id = `win-${id}`;
    win.style.zIndex = ++zCounter;

    // Default size/position
    const W = opts.width  || 700;
    const H = opts.height || 480;
    const maxX = Math.max(0, window.innerWidth - W - 40);
    const maxY = Math.max(0, window.innerHeight - H - 120);
    const x = opts.x ?? (Math.random() * Math.min(maxX, 200) + 40);
    const y = opts.y ?? (Math.random() * Math.min(maxY, 100) + 20);

    win.style.left   = x + 'px';
    win.style.top    = y + 'px';
    win.style.width  = W + 'px';
    win.style.height = H + 'px';

    win.innerHTML = `
      <div class="window-titlebar" id="titlebar-${id}">
        <div class="window-controls">
          <button class="win-btn close"    onclick="Desktop.closeWindow('${id}')"></button>
          <button class="win-btn minimise" onclick="Desktop.minimiseWindow('${id}')"></button>
          <button class="win-btn maximise" onclick="Desktop.maximiseWindow('${id}')"></button>
        </div>
        <div class="window-title">${title}</div>
      </div>
      <div class="window-content" id="wincontent-${id}"></div>
      <div class="win-resize" id="winresize-${id}"></div>`;

    container.appendChild(win);
    windows[id] = { el: win, minimised: false, maximised: false,
      origX: x, origY: y, origW: W, origH: H };

    // Populate content
    const contentEl = document.getElementById(`wincontent-${id}`);
    contentFn(contentEl);

    // Dragging
    makeDraggable(win, document.getElementById(`titlebar-${id}`));
    makeResizable(win, document.getElementById(`winresize-${id}`));

    // Focus on click
    win.addEventListener('mousedown', () => focusWindow(id));
    win.addEventListener('touchstart', () => focusWindow(id));

    focusWindow(id);
    updateDockActive(id, true);
  }

  function focusWindow(id) {
    if (activeWinId && windows[activeWinId]) {
      windows[activeWinId].el.classList.remove('focused');
    }
    activeWinId = id;
    if (windows[id]) {
      windows[id].el.style.zIndex = ++zCounter;
      windows[id].el.classList.add('focused');
    }
  }

  function closeWindow(id) {
    if (!windows[id]) return;
    windows[id].el.remove();
    delete windows[id];
    updateDockActive(id, false);
    if (activeWinId === id) activeWinId = null;
  }

  function minimiseWindow(id) {
    if (!windows[id]) return;
    windows[id].el.style.display = 'none';
    windows[id].minimised = true;
  }

  function restoreWindow(id) {
    if (!windows[id]) return;
    windows[id].el.style.display = 'flex';
    windows[id].minimised = false;
    focusWindow(id);
  }

  function maximiseWindow(id) {
    if (!windows[id]) return;
    const w = windows[id];
    if (w.maximised) {
      // Restore
      w.el.style.left   = w.origX + 'px';
      w.el.style.top    = w.origY + 'px';
      w.el.style.width  = w.origW + 'px';
      w.el.style.height = w.origH + 'px';
      w.maximised = false;
    } else {
      // Save and maximise
      w.origX = parseInt(w.el.style.left);
      w.origY = parseInt(w.el.style.top);
      w.origW = parseInt(w.el.style.width);
      w.origH = parseInt(w.el.style.height);
      w.el.style.left   = '0px';
      w.el.style.top    = '0px';
      w.el.style.width  = '100%';
      w.el.style.height = '100%';
      w.maximised = true;
    }
  }

  function toggleWindow(id) {
    if (!windows[id]) return;
    if (windows[id].minimised) restoreWindow(id);
    else if (activeWinId === id) minimiseWindow(id);
    else focusWindow(id);
  }

  function updateDockActive(id, active) {
    const btn = document.querySelector(`[data-app="${id}"]`);
    if (btn) btn.classList.toggle('active', active);
  }

  // ── Drag & Resize ───────────────────────────────────────────────────────

  function makeDraggable(win, handle) {
    let dragging = false, startX, startY, startL, startT;

    function onDown(e) {
      if (e.target.classList.contains('win-btn')) return;
      dragging = true;
      const rect = win.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startX = clientX; startY = clientY;
      startL = rect.left; startT = rect.top;
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      win.style.left = (startL + clientX - startX) + 'px';
      win.style.top  = Math.max(0, startT + clientY - startY) + 'px';
    }
    function onUp() { dragging = false; }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  }

  function makeResizable(win, handle) {
    let resizing = false, startX, startY, startW, startH;

    handle.addEventListener('mousedown', e => {
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      startW = parseInt(win.style.width);
      startH = parseInt(win.style.height);
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!resizing) return;
      win.style.width  = Math.max(360, startW + e.clientX - startX) + 'px';
      win.style.height = Math.max(240, startH + e.clientY - startY) + 'px';
    });
    document.addEventListener('mouseup', () => { resizing = false; });
  }

  // ── App launchers (called from dock/desktop icons) ──────────────────────

  function openTerminal() {
    createWindow('terminal', 'STRATA TERMINAL // STRATA-0', el => {
      Apps.buildTerminalApp(el);
    }, { width: 720, height: 480 });
  }

  function openSCiPnet() {
    createWindow('scipnet', 'SCiPNET CONSOLE', el => {
      Apps.buildSCiPnet(el);
    }, { width: 900, height: 600 });
  }

  function openBrowser() {
    createWindow('browser', 'SECURE BROWSER // STRATA', el => {
      Apps.buildBrowser(el);
    }, { width: 920, height: 580 });
  }

  function openTextEditor(filename, content) {
    createWindow('editor', 'TEXT EDITOR', el => {
      Apps.buildTextEditor(el, filename, content);
    }, { width: 720, height: 520 });
  }

  function openMediaPlayer() {
    createWindow('media', 'MEDIA EXPLORER', el => {
      Apps.buildMediaPlayer(el);
    }, { width: 820, height: 520 });
  }

  function openFileExplorer() {
    createWindow('files', 'FILE SYSTEM EXPLORER', el => {
      Apps.buildFileExplorer(el);
    }, { width: 760, height: 500 });
  }

  function openCalculator() {
    createWindow('calc', 'CALCULATOR', el => {
      Apps.buildCalculator(el);
    }, { width: 300, height: 460 });
  }

  function openArchiveWriter() {
    createWindow('archive', 'ARCHIVE WRITER // FOUNDATION DOCUMENT SYSTEM', el => {
      Apps.buildArchiveWriter(el);
    }, { width: 900, height: 640 });
  }

  return {
    launch,
    createWindow,
    closeWindow,
    minimiseWindow,
    restoreWindow,
    maximiseWindow,
    toggleWindow,
    focusWindow,
    openTerminal,
    openSCiPnet,
    openBrowser,
    openTextEditor,
    openMediaPlayer,
    openFileExplorer,
    openCalculator,
    openArchiveWriter,
  };

})();
