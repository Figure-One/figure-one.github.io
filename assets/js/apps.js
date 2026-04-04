// === APPS.JS — STRATA OS APPLICATION LAYER ===

const Apps = (() => {

  // ── TERMINAL APP (in-desktop) ───────────────────────────────────────────

  function buildTerminalApp(container) {
    container.innerHTML = `
      <div class="app-terminal-output" id="appterm-output"></div>
      <div class="app-terminal-input-row">
        <span class="app-terminal-prompt" id="appterm-prompt">STRATA ~$ </span>
        <input class="app-terminal-input" id="appterm-input" autocomplete="off" spellcheck="false" placeholder="type command…"/>
      </div>`;

    // Give the in-app terminal its own output/input so it doesn't clobber the boot terminal
    const outEl = container.querySelector('#appterm-output');
    const inEl  = container.querySelector('#appterm-input');
    const prEl  = container.querySelector('#appterm-prompt');

    // Init a secondary terminal instance using same Terminal module
    // We temporarily swap output/input pointers for this window
    // Save original boot terminal elements before swapping
    const prevOut    = document.getElementById('terminal-output');
    const prevIn     = document.getElementById('terminal-input');
    const prevPrompt = document.getElementById('terminal-prompt');

    Terminal.setOutput(outEl);
    Terminal.setInput(inEl);
    Terminal.setPrompt(prEl);
    Terminal.updatePrompt();
    Terminal.unlockInput();

    Terminal.printLine('STRATA Terminal — Desktop Session', 't-header');
    Terminal.printLine('Type help for commands.', 't-muted');
    Terminal.printBlank();

    // Focus on click
    outEl.addEventListener('click', () => inEl.focus());
    container.addEventListener('click', () => inEl.focus());

    // Restore boot terminal when this window is closed
    const observer = new MutationObserver(() => {
      if (!document.contains(container)) {
        Terminal.setOutput(prevOut);
        Terminal.setInput(prevIn);
        Terminal.setPrompt(prevPrompt);
        Terminal.updatePrompt();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Note: this terminal shares the Terminal module state
    // When window closes the boot terminal stays intact
  }

  // ── SCiPNET ─────────────────────────────────────────────────────────────

  function buildSCiPnet(container) {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';
    container.style.overflow = 'hidden';

    const user = Auth.getUser();
    container.innerHTML = `
      <div class="app-browser-bar">
        <span style="font-family:var(--font-mono);font-size:10px;color:var(--accent);">SCiPNET CONSOLE</span>
        <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:auto;">
          Clearance ${user?.clearance ?? '?'} — ${user?.uid ?? 'UNKNOWN'} — External access via Strata-3
        </span>
      </div>
      <div id="scipnet-frame-container" style="flex:1;position:relative;overflow:hidden;">
        <iframe
          id="scipnet-iframe"
          src="https://scipnet-terminal.web.app/"
          class="app-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onerror="scipnetFallback()"
          style="flex:1; height:100%; width:100%; border:none; display:block;"
        ></iframe>
        <div id="scipnet-fallback" class="hidden" style="
          position:absolute;inset:0;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:16px;
          background:var(--bg-panel);">
          <div style="font-family:var(--font-display);font-size:14px;color:var(--accent);letter-spacing:0.3em;">SCiPNET CONSOLE</div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);text-align:center;">
            SCiPNET cannot be embedded in this environment.<br>
            This is typically due to site-level frame restrictions.
          </div>
          <a href="https://scipnet-terminal.web.app/" target="_blank" style="
            padding:8px 20px;border:1px solid var(--accent);background:var(--accent-dim);
            color:var(--accent);font-family:var(--font-mono);font-size:11px;
            text-decoration:none;letter-spacing:0.15em;">
            OPEN SCiPNET IN NEW TAB →
          </a>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">
            SCiPNET requires its own login — Foundation credentials not forwarded.
          </div>
        </div>
      </div>`;

    // Check if iframe loads; if it fails show fallback
    const iframe = container.querySelector('#scipnet-iframe');
    const fallback = container.querySelector('#scipnet-fallback');

    setTimeout(() => {
      try {
        // Try to detect if iframe blocked
        if (!iframe.contentDocument && !iframe.contentWindow) {
          fallback.classList.remove('hidden');
          iframe.style.display = 'none';
        }
      } catch(e) {
        // Cross-origin — may be loading fine, leave it
      }
    }, 3000);
  }

  // ── BROWSER ─────────────────────────────────────────────────────────────

  function buildBrowser(container) {
    const user = Auth.getUser();
    const canBrowse = Auth.hasClearance(2) || Auth.hasScope('ARCHIVE') || Auth.hasScope('SRRESEARCH');

    if (!canBrowse) {
      container.innerHTML = `
        <div class="access-denied">
          <div class="access-denied-icon">🔒</div>
          <div class="access-denied-title">ACCESS DENIED</div>
          <div class="access-denied-sub">External browser access requires clearance level 2 or ARCHIVE/SRRESEARCH scope.</div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">Incident logged.</div>
        </div>`;
      return;
    }

    // Whitelist — user populates
    const whitelist = [
      /* Add URLs here, e.g.: { label: 'SCP Wiki', url: 'https://scp-wiki.wikidot.com' } */
    ];

    container.innerHTML = `
      <div class="app-browser-bar">
        <input class="browser-url" id="browser-url-input" placeholder="Enter URL or select from bookmarks…" />
        <button class="browser-go" onclick="browserNavigate()">GO</button>
      </div>
      <div style="padding:8px 12px;border-bottom:1px solid var(--border);background:var(--bg-secondary);
                  font-family:var(--font-mono);font-size:9px;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
        <span style="color:var(--warning);">⚠</span>
        EXTERNAL ACCESS — ROUTED VIA STRATA-3 PROXY — ALL TRAFFIC LOGGED
        ${whitelist.length > 0 ? '— BOOKMARKS: ' + whitelist.map(b => `<span style="color:var(--accent);cursor:pointer;" onclick="document.getElementById('browser-url-input').value='${b.url}';browserNavigate()">${b.label}</span>`).join(' | ') : '— NO BOOKMARKS CONFIGURED'}
      </div>
      <div id="browser-frame-wrap" style="flex:1;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div id="browser-placeholder" style="text-align:center;">
          <div style="font-family:var(--font-display);font-size:12px;color:var(--text-muted);letter-spacing:0.3em;margin-bottom:8px;">SECURE BROWSER</div>
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">Enter a URL above to navigate</div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--danger);margin-top:8px;">Note: many sites block iframe embedding (X-Frame-Options).</div>
        </div>
        <iframe id="browser-iframe" class="app-iframe hidden" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      </div>`;

    window.browserNavigate = function() {
      let url = document.getElementById('browser-url-input').value.trim();
      if (!url) return;
      if (!url.startsWith('http')) url = 'https://' + url;
      const iframe = document.getElementById('browser-iframe');
      const placeholder = document.getElementById('browser-placeholder');
      iframe.src = url;
      iframe.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };

    container.querySelector('#browser-url-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') window.browserNavigate();
    });
  }

  // ── TEXT EDITOR ─────────────────────────────────────────────────────────

  function buildTextEditor(container, filename, initialContent) {
    let currentFile = filename || 'untitled.txt';
    let wordCount = 0;

    container.innerHTML = `
      <div class="editor-toolbar">
        <button class="editor-btn" onclick="editorNew()">NEW</button>
        <button class="editor-btn" onclick="editorOpen()">OPEN</button>
        <button class="editor-btn" onclick="editorSave()">SAVE</button>
        <button class="editor-btn" onclick="editorSaveAs()">SAVE AS</button>
        <span style="flex:1;"></span>
        <input class="editor-filename" id="editor-filename" value="${currentFile}" spellcheck="false"/>
      </div>
      <textarea class="editor-area flex-1" id="editor-area"
        spellcheck="false" placeholder="Begin typing…"
        oninput="updateEditorStatus()">${initialContent || ''}</textarea>
      <div class="editor-statusbar">
        <span id="editor-word-count">WORDS: 0</span>
        <span id="editor-char-count">CHARS: 0</span>
        <span id="editor-line-count">LINES: 1</span>
        <span style="margin-left:auto;font-size:9px;color:var(--text-muted);">SESSION ONLY — NOT PERSISTED</span>
      </div>`;

    window.updateEditorStatus = function() {
      const text = document.getElementById('editor-area').value;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      document.getElementById('editor-word-count').textContent = `WORDS: ${words}`;
      document.getElementById('editor-char-count').textContent = `CHARS: ${text.length}`;
      document.getElementById('editor-line-count').textContent = `LINES: ${text.split('\n').length}`;
      // Auto-save to session
      const fname = document.getElementById('editor-filename').value;
      const files = JSON.parse(sessionStorage.getItem('fs_files') || '{}');
      files['/home/desktop/' + fname] = text;
      sessionStorage.setItem('fs_files', JSON.stringify(files));
    };

    window.editorNew = function() {
      if (confirm('Create new file? Unsaved changes will be lost.')) {
        document.getElementById('editor-area').value = '';
        document.getElementById('editor-filename').value = 'untitled.txt';
        updateEditorStatus();
      }
    };

    window.editorSave = function() {
      const fname = document.getElementById('editor-filename').value;
      const text  = document.getElementById('editor-area').value;
      const files = JSON.parse(sessionStorage.getItem('fs_files') || '{}');
      files['/home/desktop/' + fname] = text;
      sessionStorage.setItem('fs_files', JSON.stringify(files));
      StrataOS.showToast(`Saved: ${fname}`, 'success');
    };

    window.editorSaveAs = function() {
      const name = prompt('Save as:', document.getElementById('editor-filename').value);
      if (name) {
        document.getElementById('editor-filename').value = name;
        editorSave();
      }
    };

    window.editorOpen = function() {
      const files = JSON.parse(sessionStorage.getItem('fs_files') || '{}');
      const names = Object.keys(files).filter(k => k.startsWith('/home/'));
      if (names.length === 0) { alert('No files in session.'); return; }
      const choice = prompt('Open file:\n' + names.join('\n'));
      if (choice && files[choice]) {
        document.getElementById('editor-area').value = files[choice];
        document.getElementById('editor-filename').value = choice.split('/').pop();
        updateEditorStatus();
      }
    };

    updateEditorStatus();
    setTimeout(() => container.querySelector('#editor-area')?.focus(), 100);
  }

  // ── MEDIA PLAYER ────────────────────────────────────────────────────────

  function buildMediaPlayer(container) {
    // Persistent media loaded from assets
    // Session media stored in sessionStorage as base64
    const sessionMedia = JSON.parse(sessionStorage.getItem('session_media') || '[]');

    function getMediaList() {
      const persistent = (window.STRATA_MEDIA || []);
      return [...persistent, ...sessionMedia];
    }

    function renderMedia(item) {
      const display = container.querySelector('#media-display');
      if (!display) return;
      if (!item) { display.innerHTML = '<div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">No media selected</div>'; return; }
      if (item.type === 'image') {
        display.innerHTML = `<img src="${item.src}" alt="${item.name}" style="max-width:100%;max-height:100%;object-fit:contain;">`;
      } else if (item.type === 'video') {
        display.innerHTML = `<video src="${item.src}" controls style="max-width:100%;max-height:100%;" autoplay></video>`;
      }
    }

    function renderSidebar() {
      const list = container.querySelector('#media-list');
      if (!list) return;
      const all = getMediaList();
      if (all.length === 0) {
        list.innerHTML = '<div style="padding:12px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">No media files</div>';
        return;
      }
      list.innerHTML = all.map((m, i) => `
        <div class="media-item" onclick="selectMedia(${i})" data-idx="${i}">
          <div>${m.name}</div>
          <div class="media-item-type">${m.type || 'file'}</div>
        </div>`).join('');
    }

    container.innerHTML = `
      <div class="media-sidebar">
        <div class="media-sidebar-title">MEDIA LIBRARY</div>
        <div class="media-list" id="media-list"></div>
        <div>
          <button class="media-upload-btn" onclick="mediaUpload()">+ ADD MEDIA (SESSION)</button>
        </div>
      </div>
      <div class="media-main">
        <div class="media-display" id="media-display">
          <div style="color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">SELECT MEDIA FROM LIBRARY</div>
        </div>
        <div class="media-controls">
          <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);" id="media-info">NO FILE SELECTED</span>
          <span style="margin-left:auto;font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">SESSION UPLOADS ARE TEMPORARY</span>
        </div>
      </div>`;

    renderSidebar();

    window.selectMedia = function(idx) {
      const all = getMediaList();
      const item = all[idx];
      if (!item) return;
      renderMedia(item);
      container.querySelectorAll('.media-item').forEach((el, i) => el.classList.toggle('active', i === idx));
      const info = container.querySelector('#media-info');
      if (info) info.textContent = item.name;
    };

    window.mediaUpload = function() {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*,video/*';
      input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const isVideo = file.type.startsWith('video');
          const media = { name: file.name, src: ev.target.result, type: isVideo ? 'video' : 'image', session: true };
          const existing = JSON.parse(sessionStorage.getItem('session_media') || '[]');
          existing.push(media);
          sessionStorage.setItem('session_media', JSON.stringify(existing));
          renderSidebar();
          StrataOS.showToast(`Added: ${file.name} (session only)`, 'success');
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };
  }

  // ── FILE EXPLORER ────────────────────────────────────────────────────────

  function buildFileExplorer(container) {
    const user = Auth.getUser();
    const isIT = Auth.hasScope('NETTECH') || Auth.hasScope('SITEAUTHORITY');

    const baseDirs = [
      { path: '/home/desktop',   label: '🖥️ Desktop',   icon: '🖥️' },
      { path: '/home/downloads', label: '⬇️ Downloads',  icon: '⬇️' },
      { path: '/home/documents', label: '📄 Documents',  icon: '📄' },
      { path: '/home/media',     label: '🎬 Media',      icon: '🎬' },
    ];

    const itDirs = [
      { path: '/system',      label: '⚙️ System',     icon: '⚙️', readonly: true },
      { path: '/proxy',       label: '🔒 Proxy',      icon: '🔒', readonly: true },
      { path: '/kernel',      label: '🧩 Kernel',     icon: '🧩', readonly: true },
      { path: '/archive-proxy', label: '🗄️ Archive Proxy', icon: '🗄️', readonly: true },
    ];

    const allDirs = isIT ? [...baseDirs, ...itDirs] : baseDirs;
    let currentPath = '/home/desktop';

    function listFiles(path) {
      const files = JSON.parse(sessionStorage.getItem('fs_files') || '{}');
      return Object.entries(files).filter(([k]) => {
        const parent = k.replace(/\/[^/]+$/,'') || '/';
        return parent === path;
      });
    }

    function render() {
      const sidebar = container.querySelector('#fe-tree');
      const grid    = container.querySelector('#fe-grid');
      const crumb   = container.querySelector('#fe-breadcrumb');
      if (!sidebar || !grid || !crumb) return;

      crumb.textContent = currentPath;

      sidebar.innerHTML = allDirs.map(d => `
        <div class="file-tree-item${d.path === currentPath ? ' active' : ''}"
             onclick="feDirClick('${d.path}')">
          ${d.icon} ${d.label.split(' ').slice(1).join(' ')}
        </div>`).join('') + (isIT ? `<div class="file-tree-sep"></div>
        <div style="padding:6px 14px;font-family:var(--font-mono);font-size:8px;color:var(--text-muted);letter-spacing:0.1em;">IT ACCESS (READ-ONLY)</div>` : '');

      const files = listFiles(currentPath);
      const dir = allDirs.find(d => d.path === currentPath);
      const isReadOnly = dir?.readonly || false;

      if (files.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);padding:20px;">${isReadOnly ? '[ READ-ONLY — SYSTEM FILES PROTECTED ]' : '(empty folder)'}</div>`;
      } else {
        grid.innerHTML = files.map(([path]) => {
          const name = path.split('/').pop();
          return `<div class="file-icon" ${!isReadOnly ? `ondblclick="feOpenFile('${path}')"` : ''} title="${isReadOnly ? 'Read-only' : 'Double-click to open'}">
            <div class="file-icon-glyph">📄</div>
            <div class="file-icon-name">${name}</div>
          </div>`;
        }).join('');
      }
    }

    container.innerHTML = `
      <div class="file-explorer full">
        <div class="file-tree" id="fe-tree"></div>
        <div class="file-main">
          <div class="file-breadcrumb" id="fe-breadcrumb">/home/desktop</div>
          <div class="file-grid" id="fe-grid"></div>
        </div>
      </div>`;

    window.feDirClick = function(path) {
      currentPath = path;
      render();
    };

    window.feOpenFile = function(path) {
      const files = JSON.parse(sessionStorage.getItem('fs_files') || '{}');
      const content = files[path] || '';
      const name = path.split('/').pop();
      Desktop.openTextEditor(name, content);
    };

    render();
  }

  // ── CALCULATOR ──────────────────────────────────────────────────────────

  function buildCalculator(container) {
    let expr = '', result = '0';

    const buttons = [
      ['C','±','%','÷'],
      ['7','8','9','×'],
      ['4','5','6','−'],
      ['1','2','3','+'],
      ['0','.','⌫','='],
    ];

    container.innerHTML = `
      <div class="calc-display">
        <div class="calc-expr" id="calc-expr"></div>
        <div class="calc-value" id="calc-value">0</div>
      </div>
      <div class="calc-grid" id="calc-grid"></div>`;

    const grid = container.querySelector('#calc-grid');

    function updateDisplay() {
      const e = container.querySelector('#calc-expr');
      const v = container.querySelector('#calc-value');
      if (e) e.textContent = expr;
      if (v) v.textContent = result;
    }

    function pressBtn(val) {
      if (val === 'C') { expr = ''; result = '0'; }
      else if (val === '⌫') { expr = expr.slice(0,-1); if (!expr) result = '0'; }
      else if (val === '=') {
        try {
          const evalExpr = expr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
          result = String(eval(evalExpr));
          expr = result;
        } catch(e) { result = 'ERROR'; expr = ''; }
      }
      else if (val === '±') {
        if (expr) { expr = expr.startsWith('-') ? expr.slice(1) : '-'+expr; result = expr; }
      }
      else if (val === '%') {
        try { result = String(parseFloat(expr)/100); expr = result; } catch(e) {}
      }
      else {
        expr += val; result = expr;
      }
      updateDisplay();
    }

    buttons.forEach(row => {
      row.forEach(btn => {
        const el = document.createElement('button');
        el.className = 'calc-btn' +
          (btn === '=' ? ' eq' : '') +
          (btn.match(/[÷×−+]/) ? ' op' : '') +
          (btn === 'C' ? ' clear' : '');
        el.textContent = btn;
        el.addEventListener('click', () => pressBtn(btn));
        grid.appendChild(el);
      });
    });

    // Keyboard support
    container.addEventListener('keydown', e => {
      const map = {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        '+':'+','-':'−','*':'×','/':'÷','.':'.','Enter':'=','Backspace':'⌫','Escape':'C','%':'%'};
      if (map[e.key]) pressBtn(map[e.key]);
    });
    container.setAttribute('tabindex','0');
  }

  // ── ARCHIVE WRITER ──────────────────────────────────────────────────────

  function buildArchiveWriter(container) {
    // Containment classes
    const CONTAIN_CLASSES = ['Safe','Euclid','Keter','Neutralized','Pending','Explained','Esoteric'];
    const SECONDARY_CLASSES = ['None','Apollyon','Archon','Cernunnos','Decommissioned','Hiemal',
      'Tiamat','Ticonderoga','Thaumiel','Uncontained'];
    const DISRUPTION = ['Dark','Vlam','Keneq','Ekhi','Amida'];
    const RISK = ['Notice','Caution','Warning','Danger','Critical'];
    const CLEARANCE_LEVELS = [
      {val:1,label:'1 — Unrestricted'},
      {val:2,label:'2 — Restricted'},
      {val:3,label:'3 — Confidential'},
      {val:4,label:'4 — Secret'},
      {val:5,label:'5 — Top Secret'},
      {val:6,label:'6 — Cosmic Top Secret'},
    ];

    const DISRUPTION_COLORS = {Dark:'var(--cl-1)',Vlam:'var(--cl-2)',Keneq:'var(--cl-3)',Ekhi:'var(--cl-4)',Amida:'var(--cl-5)'};
    const RISK_COLORS = {Notice:'var(--cl-1)',Caution:'var(--cl-2)',Warning:'var(--cl-3)',Danger:'var(--cl-4)',Critical:'var(--cl-5)'};
    const CONTAIN_COLORS = {Safe:'var(--cl-1)',Euclid:'var(--cl-3)',Keter:'var(--cl-5)',
      Neutralized:'#888',Pending:'#888',Explained:'#888',Esoteric:'#888'};

    container.innerHTML = `
      <div class="archive-writer">
        <div class="archive-toolbar">
          <span class="archive-toolbar-title">ARCHIVE WRITER — FOUNDATION DOCUMENT SYSTEM</span>
          <button class="editor-btn" onclick="archiveSave()">SAVE (SESSION)</button>
          <button class="editor-btn" onclick="archiveExport()">EXPORT .TXT</button>
          <button class="editor-btn" onclick="archiveClear()">NEW DOCUMENT</button>
        </div>
        <div class="archive-body" id="archive-body">

          <!-- ACS live preview bar -->
          <div>
            <div class="section-label" style="margin-bottom:8px;">ACS CLASSIFICATION BAR PREVIEW</div>
            <div class="acs-bar" id="acs-bar-preview">
              <div class="acs-cell" id="acs-cell-item">
                <div class="acs-cell-label">ITEM NO.</div>
                <div class="acs-cell-value" id="acs-prev-item">SCP-XXXX</div>
              </div>
              <div class="acs-cell" id="acs-cell-clearance">
                <div class="acs-cell-label">CLEARANCE</div>
                <div class="acs-cell-value" id="acs-prev-clearance">1</div>
              </div>
              <div class="acs-cell" id="acs-cell-contain">
                <div class="acs-cell-label">CONTAINMENT</div>
                <div class="acs-cell-value" id="acs-prev-contain">SAFE</div>
              </div>
              <div class="acs-cell" id="acs-cell-secondary">
                <div class="acs-cell-label">SECONDARY</div>
                <div class="acs-cell-value" id="acs-prev-secondary">—</div>
              </div>
              <div class="acs-cell" id="acs-cell-disruption">
                <div class="acs-cell-label">DISRUPTION</div>
                <div class="acs-cell-value" id="acs-prev-disruption">DARK</div>
              </div>
              <div class="acs-cell" id="acs-cell-risk">
                <div class="acs-cell-label">RISK</div>
                <div class="acs-cell-value" id="acs-prev-risk">NOTICE</div>
              </div>
            </div>
          </div>

          <!-- Classification fields -->
          <div>
            <div class="section-label">DOCUMENT METADATA</div>
            <div class="acs-form-grid" style="margin-top:12px;">
              <div class="acs-field">
                <label class="acs-label">Item Number</label>
                <input class="acs-input" id="aw-item" placeholder="SCP-XXXX" oninput="awUpdate()"/>
              </div>
              <div class="acs-field">
                <label class="acs-label">Document Title</label>
                <input class="acs-input" id="aw-title" placeholder="Document title…" oninput="awUpdate()"/>
              </div>
              <div class="acs-field">
                <label class="acs-label">Author UID</label>
                <input class="acs-input" id="aw-author" value="${Auth.getUser()?.uid || ''}" oninput="awUpdate()"/>
              </div>
              <div class="acs-field">
                <label class="acs-label">Date</label>
                <input class="acs-input" id="aw-date" type="date" value="${new Date().toISOString().split('T')[0]}" oninput="awUpdate()"/>
              </div>
            </div>
          </div>

          <!-- ACS Classification fields -->
          <div>
            <div class="section-label">ACS CLASSIFICATION</div>
            <div class="acs-form-grid" style="margin-top:12px;">
              <div class="acs-field">
                <label class="acs-label">Clearance Level</label>
                <select class="acs-select" id="aw-clearance" onchange="awUpdate()">
                  ${CLEARANCE_LEVELS.map(l => `<option value="${l.val}">${l.label}</option>`).join('')}
                </select>
              </div>
              <div class="acs-field">
                <label class="acs-label">Containment Class</label>
                <select class="acs-select" id="aw-contain" onchange="awUpdate()">
                  ${CONTAIN_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="acs-field">
                <label class="acs-label">Secondary / Esoteric Class</label>
                <select class="acs-select" id="aw-secondary" onchange="awUpdate()">
                  ${SECONDARY_CLASSES.map(c => `<option value="${c}">${c}</option>`).join('')}
                </select>
              </div>
              <div class="acs-field">
                <label class="acs-label">Disruption Class</label>
                <select class="acs-select" id="aw-disruption" onchange="awUpdate()">
                  ${DISRUPTION.map(d => `<option value="${d}">${d}</option>`).join('')}
                </select>
              </div>
              <div class="acs-field">
                <label class="acs-label">Risk Class</label>
                <select class="acs-select" id="aw-risk" onchange="awUpdate()">
                  ${RISK.map(r => `<option value="${r}">${r}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- ACS descriptions helper -->
          <div id="acs-hint-block" style="
            border:1px solid var(--border);padding:12px 16px;
            background:var(--bg-secondary);
            font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
            line-height:1.7;
          ">
            <span style="color:var(--accent);">CLASSIFICATION GUIDE</span><br>
            <span style="color:var(--text-muted);">
              <b style="color:var(--text-secondary);">Containment:</b> Safe (contained without risk) · Euclid (requires active containment) · Keter (difficult/impossible to contain) · Neutralized (no longer anomalous) · Esoteric (use Secondary Class)<br>
              <b style="color:var(--text-secondary);">Disruption:</b> Dark (negligible) → Vlam (localised) → Keneq (city-scale) → Ekhi (global) → Amida (existential)<br>
              <b style="color:var(--text-secondary);">Risk:</b> Notice (negligible) → Caution (mild) → Warning (moderate) → Danger (severe) → Critical (near-instant/fatal)
            </span>
          </div>

          <!-- Document sections -->
          <div>
            <div class="section-label">SPECIAL CONTAINMENT PROCEDURES</div>
            <textarea class="archive-content-area" id="aw-scp" rows="5"
              placeholder="Describe the procedures and protocols for containing this anomaly…"></textarea>
          </div>

          <div>
            <div class="section-label">DESCRIPTION</div>
            <textarea class="archive-content-area" id="aw-desc" rows="8"
              placeholder="Describe the anomaly's appearance, behaviour, and known properties…"></textarea>
          </div>

          <div>
            <div class="section-label">ADDENDA / INCIDENT LOGS (OPTIONAL)</div>
            <textarea class="archive-content-area" id="aw-addenda" rows="6"
              placeholder="Supplemental logs, experiment records, interview transcripts, incident reports…"></textarea>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="archive-save-btn" onclick="archiveSave()">SAVE TO SESSION</button>
            <button class="archive-save-btn" onclick="archiveExport()">EXPORT AS .TXT</button>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:auto;">
              All documents are session-only unless exported.
            </span>
          </div>

        </div>
      </div>`;

    // Live ACS bar update
    window.awUpdate = function() {
      const item      = document.getElementById('aw-item')?.value || 'SCP-XXXX';
      const clearance = document.getElementById('aw-clearance')?.value || '1';
      const contain   = document.getElementById('aw-contain')?.value || 'Safe';
      const secondary = document.getElementById('aw-secondary')?.value || 'None';
      const disrupt   = document.getElementById('aw-disruption')?.value || 'Dark';
      const risk      = document.getElementById('aw-risk')?.value || 'Notice';

      document.getElementById('acs-prev-item').textContent      = item;
      document.getElementById('acs-prev-clearance').textContent = clearance;
      document.getElementById('acs-prev-contain').textContent   = contain.toUpperCase();
      document.getElementById('acs-prev-secondary').textContent = secondary === 'None' ? '—' : secondary.toUpperCase();
      document.getElementById('acs-prev-disruption').textContent = disrupt.toUpperCase();
      document.getElementById('acs-prev-risk').textContent      = risk.toUpperCase();

      // Colour cells
      const cellContain  = document.getElementById('acs-cell-contain');
      const cellDisrupt  = document.getElementById('acs-cell-disruption');
      const cellRisk     = document.getElementById('acs-cell-risk');
      const cellClear    = document.getElementById('acs-cell-clearance');

      if (cellContain)  cellContain.style.background  = CONTAIN_COLORS[contain]   || '#888';
      if (cellDisrupt)  cellDisrupt.style.background  = DISRUPTION_COLORS[disrupt] || '#888';
      if (cellRisk)     cellRisk.style.background     = RISK_COLORS[risk]          || '#888';
      // Set text colour for visibility
      [cellContain, cellDisrupt, cellRisk].forEach(c => { if (c) c.style.color = '#fff'; });
    };

    window.archiveSave = function() {
      const item = document.getElementById('aw-item')?.value || 'untitled';
      const doc  = buildArchiveDoc();
      const files = JSON.parse(sessionStorage.getItem('fs_files') || '{}');
      files[`/home/documents/${item}.txt`] = doc;
      sessionStorage.setItem('fs_files', JSON.stringify(files));
      StrataOS.showToast(`Saved: ${item}.txt`, 'success');
    };

    window.archiveExport = function() {
      const item = document.getElementById('aw-item')?.value || 'document';
      const doc  = buildArchiveDoc();
      const blob = new Blob([doc], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${item}.txt`;
      a.click();
    };

    window.archiveClear = function() {
      if (confirm('Clear all fields?')) {
        ['aw-item','aw-title','aw-author','aw-scp','aw-desc','aw-addenda'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        document.getElementById('aw-date').value = new Date().toISOString().split('T')[0];
        awUpdate();
      }
    };

    function buildArchiveDoc() {
      const item     = document.getElementById('aw-item')?.value || 'SCP-XXXX';
      const title    = document.getElementById('aw-title')?.value || '';
      const author   = document.getElementById('aw-author')?.value || '';
      const date     = document.getElementById('aw-date')?.value || '';
      const clearance = document.getElementById('aw-clearance')?.value || '1';
      const contain  = document.getElementById('aw-contain')?.value || 'Safe';
      const secondary = document.getElementById('aw-secondary')?.value || 'None';
      const disrupt  = document.getElementById('aw-disruption')?.value || 'Dark';
      const risk     = document.getElementById('aw-risk')?.value || 'Notice';
      const scp      = document.getElementById('aw-scp')?.value || '';
      const desc     = document.getElementById('aw-desc')?.value || '';
      const addenda  = document.getElementById('aw-addenda')?.value || '';
      const cl_labels = {1:'Unrestricted',2:'Restricted',3:'Confidential',4:'Secret',5:'Top Secret',6:'Cosmic Top Secret'};

      return [
        '═'.repeat(70),
        `ITEM #: ${item}${title ? '  —  ' + title : ''}`,
        `AUTHOR: ${author}  |  DATE: ${date}`,
        '═'.repeat(70),
        '',
        `CLEARANCE LEVEL: ${clearance} — ${cl_labels[clearance] || ''}`,
        `CONTAINMENT CLASS: ${contain.toUpperCase()}`,
        secondary !== 'None' ? `SECONDARY CLASS: ${secondary.toUpperCase()}` : '',
        `DISRUPTION CLASS: ${disrupt.toUpperCase()}`,
        `RISK CLASS: ${risk.toUpperCase()}`,
        '',
        '─'.repeat(70),
        'SPECIAL CONTAINMENT PROCEDURES',
        '─'.repeat(70),
        scp,
        '',
        '─'.repeat(70),
        'DESCRIPTION',
        '─'.repeat(70),
        desc,
        addenda ? [
          '',
          '─'.repeat(70),
          'ADDENDA',
          '─'.repeat(70),
          addenda,
        ].join('\n') : '',
        '',
        '═'.repeat(70),
        `END OF DOCUMENT — ${item}`,
        '═'.repeat(70),
      ].filter(l => l !== '').join('\n');
    }

    // Initialise the live bar
    window.awUpdate();
  }

  return {
    buildTerminalApp,
    buildSCiPnet,
    buildBrowser,
    buildTextEditor,
    buildMediaPlayer,
    buildFileExplorer,
    buildCalculator,
    buildArchiveWriter,
  };

})();
