// === APPS.JS — STRATA OS APPLICATION LAYER ===

const Apps = (() => {

  // ── CLIPBOARD (cut/copy/paste across apps) ──────────────────────────────
  let clipboard = null; // { op: 'copy'|'cut', path, name, content }

  // ── FILE TYPE DETECTION ─────────────────────────────────────────────────

  function fileTypeOf(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['txt','md','log','json','xml','yaml','yml','csv','html','htm','css','js','ts','py','sh','bat','ini','cfg','conf','toml','sql','rtf'].includes(ext)) return 'text';
    if (['jpg','jpeg','png','gif','webp','bmp','svg','avif','ico','tiff','tif'].includes(ext)) return 'image';
    if (['mp4','webm','ogv','mov','mkv','avi','wmv','flv','m4v'].includes(ext)) return 'video';
    if (['mp3','ogg','wav','flac','aac','m4a','opus','weba','wma'].includes(ext)) return 'audio';
    return 'unknown';
  }

  // Whether a file needs binary (base64) reading vs text reading
  function isBinaryFile(name) {
    const type = fileTypeOf(name);
    return type === 'image' || type === 'audio' || type === 'video';
  }

  function fileIcon(name) {
    switch (fileTypeOf(name)) {
      case 'text':    return '📄';
      case 'image':   return '🖼️';
      case 'video':   return '🎬';
      case 'audio':   return '🎵';
      default:        return '📦';
    }
  }

  // ── CONTEXT MENU ────────────────────────────────────────────────────────

  function showContextMenu(x, y, items) {
    removeContextMenu();
    const menu = document.createElement('div');
    menu.id = 'strata-ctx-menu';
    menu.style.cssText = `
      position:fixed;z-index:99999;
      left:${x}px;top:${y}px;
      background:var(--bg-panel);border:1px solid var(--border);
      box-shadow:var(--panel-shadow);
      font-family:var(--font-mono);font-size:11px;
      min-width:180px;padding:4px 0;`;

    items.forEach(item => {
      if (item === 'sep') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:var(--border);margin:4px 0;';
        menu.appendChild(sep);
        return;
      }
      const el = document.createElement('div');
      el.style.cssText = `
        padding:7px 16px;cursor:pointer;color:${item.danger ? 'var(--danger)' : item.disabled ? 'var(--text-muted)' : 'var(--text-secondary)'};
        display:flex;align-items:center;gap:10px;
        transition:background 0.1s,color 0.1s;
        pointer-events:${item.disabled ? 'none' : 'all'};
        user-select:none;`;
      el.innerHTML = `<span style="width:14px;text-align:center;opacity:0.7;">${item.icon || ''}</span><span>${item.label}</span>${item.shortcut ? `<span style="margin-left:auto;opacity:0.4;font-size:9px;">${item.shortcut}</span>` : ''}`;
      if (!item.disabled) {
        el.addEventListener('mouseenter', () => {
          el.style.background = 'var(--accent-dim)';
          el.style.color = item.danger ? 'var(--danger)' : 'var(--accent)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.background = '';
          el.style.color = item.danger ? 'var(--danger)' : 'var(--text-secondary)';
        });
        el.addEventListener('mousedown', e => {
          e.stopPropagation();
          removeContextMenu();
          item.action();
        });
      }
      menu.appendChild(el);
    });

    document.body.appendChild(menu);

    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right  > window.innerWidth)  menu.style.left = (x - r.width)  + 'px';
      if (r.bottom > window.innerHeight) menu.style.top  = (y - r.height) + 'px';
    });

    const dismiss = e => {
      if (!menu.contains(e.target)) { removeContextMenu(); document.removeEventListener('mousedown', dismiss); }
    };
    setTimeout(() => document.addEventListener('mousedown', dismiss), 0);
  }

  function removeContextMenu() {
    document.getElementById('strata-ctx-menu')?.remove();
  }

  // ── RENAME MODAL ─────────────────────────────────────────────────────────

  function showRenameModal(currentName) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);
        backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;`;
      const panel = document.createElement('div');
      panel.style.cssText = `background:var(--bg-panel);border:1px solid var(--border);
        box-shadow:var(--panel-shadow);padding:28px;min-width:360px;font-family:var(--font-mono);`;
      panel.innerHTML = `
        <div style="font-family:var(--font-display);font-size:9px;color:var(--accent);
                    letter-spacing:0.2em;margin-bottom:16px;">RENAME FILE</div>
        <input id="rename-input" style="width:100%;background:var(--bg-primary);border:1px solid var(--border);
               padding:8px 12px;font-family:var(--font-mono);font-size:12px;color:var(--text-primary);
               outline:none;margin-bottom:16px;" value="${currentName}"/>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button id="rn-cancel" style="padding:6px 16px;border:1px solid var(--border);background:transparent;
                  color:var(--text-muted);font-family:var(--font-mono);font-size:11px;cursor:pointer;">CANCEL</button>
          <button id="rn-ok" style="padding:6px 16px;border:1px solid var(--accent);background:var(--accent-dim);
                  color:var(--accent);font-family:var(--font-mono);font-size:11px;cursor:pointer;">RENAME</button>
        </div>`;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      const input = panel.querySelector('#rename-input');
      input.focus(); input.select();
      const finish = val => { overlay.remove(); resolve(val); };
      panel.querySelector('#rn-ok').addEventListener('click', () => finish(input.value.trim() || null));
      panel.querySelector('#rn-cancel').addEventListener('click', () => finish(null));
      input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(input.value.trim() || null); if (e.key === 'Escape') finish(null); });
    });
  }

  // ── FILE OPERATIONS ──────────────────────────────────────────────────────

  function fsGet()          { return JSON.parse(sessionStorage.getItem('fs_files') || '{}'); }
  function fsSet(files)     { sessionStorage.setItem('fs_files', JSON.stringify(files)); }

  function fsRename(oldPath, newName) {
    const files = fsGet();
    const dir   = oldPath.replace(/\/[^/]+$/, '');
    const newPath = dir + '/' + newName;
    if (files[newPath] !== undefined) { StrataOS.showToast('A file with that name already exists', 'error'); return false; }
    files[newPath] = files[oldPath];
    delete files[oldPath];
    fsSet(files);
    return newPath;
  }

  function fsDelete(path) {
    const files = fsGet();
    delete files[path];
    fsSet(files);
  }

  function fsMove(srcPath, destDir) {
    const files   = fsGet();
    const name    = srcPath.split('/').pop();
    const destPath = destDir + '/' + name;
    if (files[destPath] !== undefined) { StrataOS.showToast('File already exists at destination', 'error'); return false; }
    files[destPath] = files[srcPath];
    delete files[srcPath];
    fsSet(files);
    return destPath;
  }

  function fsCopy(srcPath, destDir) {
    const files    = fsGet();
    const name     = srcPath.split('/').pop();
    let destPath   = destDir + '/' + name;
    if (files[destPath] !== undefined) {
      const ext  = name.includes('.') ? '.' + name.split('.').pop() : '';
      const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
      let i = 2;
      while (files[destDir + '/' + base + '_copy' + (i > 2 ? i : '') + ext] !== undefined) i++;
      destPath = destDir + '/' + base + '_copy' + (i > 2 ? i : '') + ext;
    }
    files[destPath] = files[srcPath];
    fsSet(files);
    return destPath;
  }

  // ── FILE PICKER MODAL ───────────────────────────────────────────────────

  function showFilePicker(opts = {}) {
    return new Promise(resolve => {
      const mode        = opts.mode || 'open';
      const defaultName = opts.defaultName || '';

      const baseDirs = [
        '/home/desktop',
        '/home/downloads',
        '/home/documents',
        '/home/media',
      ];

      let currentPath = '/home/desktop';
      let selectedPath = null;

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;inset:0;z-index:9999;
        background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);
        display:flex;align-items:center;justify-content:center;`;

      const panel = document.createElement('div');
      panel.style.cssText = `
        background:var(--bg-panel);border:1px solid var(--border);
        box-shadow:var(--panel-shadow);
        width:560px;max-width:95vw;display:flex;flex-direction:column;
        font-family:var(--font-mono);`;

      panel.innerHTML = `
        <div style="padding:10px 16px;border-bottom:1px solid var(--border);
                    background:var(--bg-secondary);display:flex;align-items:center;
                    justify-content:space-between;">
          <span style="font-family:var(--font-display);font-size:9px;letter-spacing:0.2em;
                       color:var(--accent);">${mode === 'open' ? 'OPEN FILE' : 'SAVE FILE'}</span>
          <button id="fp-close" style="background:none;border:none;color:var(--text-muted);
                  cursor:pointer;font-size:14px;padding:0 4px;">✕</button>
        </div>
        <div style="display:flex;height:320px;">
          <div style="width:160px;border-right:1px solid var(--border);
                      overflow-y:auto;padding:8px 0;flex-shrink:0;" id="fp-sidebar"></div>
          <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;">
            <div style="padding:6px 12px;border-bottom:1px solid var(--border);
                        background:var(--bg-secondary);font-size:10px;
                        color:var(--text-muted);" id="fp-crumb">/home/desktop</div>
            <div style="flex:1;overflow-y:auto;padding:8px;
                        display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));
                        gap:6px;align-content:start;" id="fp-grid"></div>
          </div>
        </div>
        <div style="padding:10px 16px;border-top:1px solid var(--border);
                    background:var(--bg-secondary);display:flex;align-items:center;gap:8px;">
          <span style="font-size:10px;color:var(--text-muted);white-space:nowrap;">File name:</span>
          <input id="fp-name" style="flex:1;background:var(--bg-primary);border:1px solid var(--border);
                 padding:5px 10px;font-family:var(--font-mono);font-size:12px;
                 color:var(--text-primary);outline:none;"
                 value="${defaultName}" placeholder="${mode === 'open' ? 'Select a file…' : 'Enter filename…'}"/>
        </div>
        <div style="padding:10px 16px;border-top:1px solid var(--border);
                    display:flex;justify-content:flex-end;gap:8px;">
          <button id="fp-cancel" style="padding:6px 16px;border:1px solid var(--border);
                  background:transparent;color:var(--text-muted);font-family:var(--font-mono);
                  font-size:11px;cursor:pointer;letter-spacing:0.1em;">CANCEL</button>
          <button id="fp-confirm" style="padding:6px 16px;border:1px solid var(--accent);
                  background:var(--accent-dim);color:var(--accent);font-family:var(--font-mono);
                  font-size:11px;cursor:pointer;letter-spacing:0.1em;">
                  ${mode === 'open' ? 'OPEN' : 'SAVE'}</button>
        </div>`;

      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      const sidebar   = panel.querySelector('#fp-sidebar');
      const grid      = panel.querySelector('#fp-grid');
      const crumb     = panel.querySelector('#fp-crumb');
      const nameInput = panel.querySelector('#fp-name');

      function renderSidebar() {
        sidebar.innerHTML = baseDirs.map(d => `
          <div style="padding:6px 14px;cursor:pointer;font-size:11px;
                      color:${d === currentPath ? 'var(--accent)' : 'var(--text-secondary)'};
                      background:${d === currentPath ? 'var(--accent-dim)' : 'transparent'};
                      border-left:2px solid ${d === currentPath ? 'var(--accent)' : 'transparent'};
                      transition:all 0.15s;"
               onmouseover="this.style.background='var(--accent-dim)'"
               onmouseout="this.style.background='${d === currentPath ? 'var(--accent-dim)' : 'transparent'}'"
               onclick="fpNav('${d}')">
            ${d.split('/').pop()}
          </div>`).join('');
      }

      function renderGrid() {
        crumb.textContent = currentPath;
        const files = fsGet();
        const entries = Object.keys(files).filter(k => {
          const parent = k.replace(/\/[^/]+$/, '') || '/';
          return parent === currentPath;
        });

        if (entries.length === 0) {
          grid.innerHTML = `<div style="grid-column:1/-1;font-size:11px;
            color:var(--text-muted);padding:20px;">(empty folder)</div>`;
          return;
        }

        grid.innerHTML = entries.map(p => {
          const name = p.split('/').pop();
          const isSelected = p === selectedPath;
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;
                       padding:8px 4px;cursor:pointer;border:1px solid ${isSelected ? 'var(--accent)' : 'transparent'};
                       background:${isSelected ? 'var(--accent-dim)' : 'transparent'};
                       transition:all 0.15s;"
                       onmouseover="this.style.background='var(--accent-dim)';this.style.borderColor='var(--border)'"
                       onmouseout="this.style.background='${isSelected ? 'var(--accent-dim)' : 'transparent'}';this.style.borderColor='${isSelected ? 'var(--accent)' : 'transparent'}'"
                       onclick="fpSelect('${p}')"
                       ondblclick="fpConfirm('${p}')">
                    <div style="font-size:22px;">${fileIcon(name)}</div>
                    <div style="font-size:9px;color:var(--text-secondary);text-align:center;
                                word-break:break-all;">${name}</div>
                  </div>`;
        }).join('');
      }

      window.fpNav    = path => { currentPath = path; selectedPath = null; renderSidebar(); renderGrid(); };
      window.fpSelect = path => { selectedPath = path; nameInput.value = path.split('/').pop(); renderGrid(); };
      window.fpConfirm = path => { selectedPath = path; nameInput.value = path.split('/').pop(); doConfirm(); };

      function doConfirm() {
        const name = nameInput.value.trim();
        if (!name) return;
        const fullPath = mode === 'open'
          ? (selectedPath || currentPath + '/' + name)
          : currentPath + '/' + name;
        cleanup();
        resolve({ path: fullPath, name: name.split('/').pop() });
      }

      function doCancel() { cleanup(); resolve(null); }

      function cleanup() {
        delete window.fpNav; delete window.fpSelect; delete window.fpConfirm;
        overlay.remove();
      }

      panel.querySelector('#fp-confirm').addEventListener('click', doConfirm);
      panel.querySelector('#fp-cancel').addEventListener('click', doCancel);
      panel.querySelector('#fp-close').addEventListener('click', doCancel);
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') doConfirm(); });
      overlay.addEventListener('click', e => { if (e.target === overlay) doCancel(); });

      renderSidebar(); renderGrid();
      setTimeout(() => nameInput.focus(), 50);
    });
  }

  // ── MOVE FILE PICKER ─────────────────────────────────────────────────────

  function showMovePicker(fileName) {
    return new Promise(resolve => {
      const dirs = ['/home/desktop','/home/downloads','/home/documents','/home/media'];
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);
        backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;`;
      const panel = document.createElement('div');
      panel.style.cssText = `background:var(--bg-panel);border:1px solid var(--border);
        box-shadow:var(--panel-shadow);padding:28px;min-width:320px;font-family:var(--font-mono);`;
      panel.innerHTML = `
        <div style="font-family:var(--font-display);font-size:9px;color:var(--accent);
                    letter-spacing:0.2em;margin-bottom:4px;">MOVE FILE</div>
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);
                    margin-bottom:16px;">Move <span style="color:var(--text-primary);">${fileName}</span> to:</div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
          ${dirs.map(d => `
            <div class="move-dir-opt" data-path="${d}"
                 style="padding:8px 12px;border:1px solid var(--border);cursor:pointer;
                        font-size:11px;color:var(--text-secondary);transition:all 0.15s;">
              ${d}
            </div>`).join('')}
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button id="mv-cancel" style="padding:6px 16px;border:1px solid var(--border);background:transparent;
                  color:var(--text-muted);font-family:var(--font-mono);font-size:11px;cursor:pointer;">CANCEL</button>
        </div>`;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      panel.querySelectorAll('.move-dir-opt').forEach(el => {
        el.addEventListener('mouseenter', () => { el.style.background='var(--accent-dim)'; el.style.color='var(--accent)'; el.style.borderColor='var(--accent)'; });
        el.addEventListener('mouseleave', () => { el.style.background=''; el.style.color='var(--text-secondary)'; el.style.borderColor='var(--border)'; });
        el.addEventListener('click', () => { overlay.remove(); resolve(el.dataset.path); });
      });
      panel.querySelector('#mv-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
    });
  }

  function showConfirmModal(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);
        backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;`;
      const panel = document.createElement('div');
      panel.style.cssText = `background:var(--bg-panel);border:1px solid var(--border);
        box-shadow:var(--panel-shadow);padding:32px;min-width:360px;font-family:var(--font-mono);`;
      panel.innerHTML = `
        <div style="font-size:13px;color:var(--text-primary);margin-bottom:24px;line-height:1.6;">${message}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button id="cm-no"  style="padding:6px 16px;border:1px solid var(--border);background:transparent;
                  color:var(--text-muted);font-family:var(--font-mono);font-size:11px;cursor:pointer;letter-spacing:0.1em;">CANCEL</button>
          <button id="cm-yes" style="padding:6px 16px;border:1px solid var(--accent);background:var(--accent-dim);
                  color:var(--accent);font-family:var(--font-mono);font-size:11px;cursor:pointer;letter-spacing:0.1em;">CONFIRM</button>
        </div>`;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      panel.querySelector('#cm-yes').addEventListener('click', () => { overlay.remove(); resolve(true); });
      panel.querySelector('#cm-no').addEventListener('click',  () => { overlay.remove(); resolve(false); });
    });
  }

  // ── TERMINAL APP (in-desktop) ───────────────────────────────────────────

  function buildTerminalApp(container) {
    container.innerHTML = `
      <div class="app-terminal-output" id="appterm-output"></div>
      <div class="app-terminal-input-row">
        <span class="app-terminal-prompt" id="appterm-prompt">STRATA ~$ </span>
        <input class="app-terminal-input" id="appterm-input" autocomplete="off" spellcheck="false" placeholder="type command…"/>
      </div>`;

    const outEl = container.querySelector('#appterm-output');
    const inEl  = container.querySelector('#appterm-input');
    const prEl  = container.querySelector('#appterm-prompt');

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

    outEl.addEventListener('click', () => inEl.focus());
    container.addEventListener('click', () => inEl.focus());

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
        <iframe id="scipnet-iframe" src="https://scipnet-terminal.web.app/" class="app-iframe"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          style="flex:1;height:100%;width:100%;border:none;display:block;"></iframe>
        <div id="scipnet-fallback" class="hidden" style="position:absolute;inset:0;display:flex;
          flex-direction:column;align-items:center;justify-content:center;gap:16px;background:var(--bg-panel);">
          <div style="font-family:var(--font-display);font-size:14px;color:var(--accent);letter-spacing:0.3em;">SCiPNET CONSOLE</div>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);text-align:center;">
            SCiPNET cannot be embedded in this environment.<br>This is typically due to site-level frame restrictions.</div>
          <a href="https://scipnet-terminal.web.app/" target="_blank" style="padding:8px 20px;border:1px solid var(--accent);
            background:var(--accent-dim);color:var(--accent);font-family:var(--font-mono);font-size:11px;
            text-decoration:none;letter-spacing:0.15em;">OPEN SCiPNET IN NEW TAB →</a>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">
            SCiPNET requires its own login — Foundation credentials not forwarded.</div>
        </div>
      </div>`;

    const iframe   = container.querySelector('#scipnet-iframe');
    const fallback = container.querySelector('#scipnet-fallback');
    setTimeout(() => {
      try {
        if (!iframe.contentDocument && !iframe.contentWindow) {
          fallback.classList.remove('hidden'); iframe.style.display = 'none';
        }
      } catch(e) {}
    }, 3000);
  }

  // ── BROWSER ─────────────────────────────────────────────────────────────

  function buildBrowser(container) {
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

    const whitelist = [];
    container.innerHTML = `
      <div class="app-browser-bar">
        <input class="browser-url" id="browser-url-input" placeholder="Enter URL or select from bookmarks…"/>
        <button class="browser-go" onclick="browserNavigate()">GO</button>
      </div>
      <div style="padding:8px 12px;border-bottom:1px solid var(--border);background:var(--bg-secondary);
                  font-family:var(--font-mono);font-size:9px;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
        <span style="color:var(--warning);">⚠</span>
        EXTERNAL ACCESS — ROUTED VIA STRATA-3 PROXY — ALL TRAFFIC LOGGED
        ${whitelist.length > 0 ? '— BOOKMARKS: ' + whitelist.map(b =>
          `<span style="color:var(--accent);cursor:pointer;"
            onclick="document.getElementById('browser-url-input').value='${b.url}';browserNavigate()">${b.label}</span>`
        ).join(' | ') : '— NO BOOKMARKS CONFIGURED'}
      </div>
      <div id="browser-frame-wrap" style="flex:1;position:relative;overflow:hidden;display:flex;
                                          flex-direction:column;align-items:center;justify-content:center;">
        <div id="browser-placeholder" style="text-align:center;">
          <div style="font-family:var(--font-display);font-size:12px;color:var(--text-muted);
                      letter-spacing:0.3em;margin-bottom:8px;">SECURE BROWSER</div>
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);">Enter a URL above to navigate</div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--danger);margin-top:8px;">
            Note: many sites block iframe embedding (X-Frame-Options).</div>
        </div>
        <iframe id="browser-iframe" class="app-iframe hidden"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
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
    let currentSavePath = filename ? '/home/desktop/' + filename : null;

    container.style.display    = 'flex';
    container.style.flexDirection = 'column';
    container.style.height     = '100%';
    container.style.overflow   = 'hidden';

    container.innerHTML = `
      <div class="editor-toolbar">
        <button class="editor-btn" id="btn-new">NEW</button>
        <button class="editor-btn" id="btn-open">OPEN</button>
        <button class="editor-btn" id="btn-save">SAVE</button>
        <button class="editor-btn" id="btn-saveas">SAVE AS</button>
        <span style="flex:1;"></span>
        <input class="editor-filename" id="editor-filename"
          value="${filename || 'untitled.txt'}" spellcheck="false"
          title="Current filename"/>
      </div>
      <textarea class="editor-area" id="editor-area"
        spellcheck="false" placeholder="Begin typing…"></textarea>
      <div class="editor-statusbar">
        <span id="editor-word-count">WORDS: 0</span>
        <span id="editor-char-count">CHARS: 0</span>
        <span id="editor-line-count">LINES: 1</span>
        <span id="editor-save-status" style="margin-left:auto;font-size:9px;color:var(--text-muted);">SESSION ONLY — NOT PERSISTED</span>
      </div>`;

    const area       = container.querySelector('#editor-area');
    const fnInput    = container.querySelector('#editor-filename');
    const saveStatus = container.querySelector('#editor-save-status');

    if (initialContent !== undefined && initialContent !== null) {
      area.value = initialContent;
    } else if (currentSavePath) {
      const files = fsGet();
      if (files[currentSavePath]) area.value = files[currentSavePath];
    }

    function updateStatus() {
      const text  = area.value;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      container.querySelector('#editor-word-count').textContent = `WORDS: ${words}`;
      container.querySelector('#editor-char-count').textContent = `CHARS: ${text.length}`;
      container.querySelector('#editor-line-count').textContent = `LINES: ${text.split('\n').length}`;
    }

    function doSave(path) {
      const files = fsGet();
      files[path] = area.value;
      fsSet(files);
      currentSavePath = path;
      fnInput.value = path.split('/').pop();
      saveStatus.textContent = `SAVED — ${path.split('/').pop()}`;
      saveStatus.style.color = 'var(--success)';
      setTimeout(() => { saveStatus.textContent = 'SESSION ONLY — NOT PERSISTED'; saveStatus.style.color = 'var(--text-muted)'; }, 2000);
      StrataOS.showToast(`Saved: ${path.split('/').pop()}`, 'success');
    }

    area.addEventListener('input', updateStatus);

    area.addEventListener('contextmenu', e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        { icon: '✂️', label: 'Cut',   shortcut: 'Ctrl+X', action: () => { document.execCommand('cut');   } },
        { icon: '📋', label: 'Copy',  shortcut: 'Ctrl+C', action: () => { document.execCommand('copy');  } },
        { icon: '📌', label: 'Paste', shortcut: 'Ctrl+V', action: () => { document.execCommand('paste'); } },
        'sep',
        { icon: '🗑️', label: 'Clear editor', danger: true, action: async () => {
          const ok = await showConfirmModal('Clear all editor content?');
          if (ok) { area.value = ''; updateStatus(); }
        }},
      ]);
    });

    container.querySelector('#btn-new').addEventListener('click', async () => {
      const ok = await showConfirmModal('Create new file? Unsaved changes will be lost.');
      if (ok) { area.value = ''; fnInput.value = 'untitled.txt'; currentSavePath = null; updateStatus(); }
    });

    container.querySelector('#btn-open').addEventListener('click', async () => {
      const result = await showFilePicker({ mode: 'open' });
      if (!result) return;
      const files = fsGet();
      if (files[result.path] === undefined) { StrataOS.showToast(`File not found: ${result.name}`, 'error'); return; }
      area.value = files[result.path];
      fnInput.value = result.name;
      currentSavePath = result.path;
      updateStatus();
    });

    container.querySelector('#btn-save').addEventListener('click', () => {
      const path = currentSavePath || (fnInput.value.trim() ? '/home/desktop/' + fnInput.value.trim() : null);
      if (!path) { container.querySelector('#btn-saveas').click(); return; }
      doSave(path);
    });

    container.querySelector('#btn-saveas').addEventListener('click', async () => {
      const result = await showFilePicker({ mode: 'save', defaultName: fnInput.value || 'untitled.txt' });
      if (!result) return;
      doSave(result.path);
    });

    updateStatus();
    setTimeout(() => area.focus(), 100);
  }

  // ── MEDIA PLAYER ────────────────────────────────────────────────────────

  function buildMediaPlayer(container, openPath) {

    function mediaTypeOf(name) {
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (['mp4','webm','ogv','mov','mkv','avi'].includes(ext)) return 'video';
      if (['mp3','ogg','wav','flac','aac','m4a','opus','weba'].includes(ext)) return 'audio';
      if (['jpg','jpeg','png','gif','webp','bmp','svg','avif'].includes(ext)) return 'image';
      return 'unknown';
    }

    function getMediaList() {
      const predefined = (window.STRATA_MEDIA || []).map(m => ({
        name: m.name, src: m.src, type: m.type || mediaTypeOf(m.name)
      }));
      const fromFs = Object.entries(fsGet())
        .filter(([k]) => k.replace(/\/[^/]+$/, '') === '/home/media')
        .map(([k, v]) => ({ name: k.split('/').pop(), src: v, type: mediaTypeOf(k.split('/').pop()) }));
      return [...predefined, ...fromFs];
    }

    function fmtTime(s) {
      if (!isFinite(s)) return '0:00';
      const m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2,'0')}`;
    }

    let currentIdx  = -1;
    let activeMedia = null;

    // ── Build layout ────────────────────────────────────────────────────
    container.style.cssText = 'display:flex;flex-direction:row;height:100%;overflow:hidden;width:100%;';
    container.innerHTML = `
      <!-- Sidebar -->
      <div style="width:220px;min-width:180px;border-right:1px solid var(--border);
                  display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;height:100%;">
        <div style="padding:10px 12px;border-bottom:1px solid var(--border);flex-shrink:0;
                    font-family:var(--font-mono);font-size:10px;color:var(--accent);
                    letter-spacing:0.15em;text-transform:uppercase;">MEDIA LIBRARY</div>
        <div id="mp-list" style="flex:1;overflow-y:auto;min-height:0;
                                  scrollbar-width:thin;scrollbar-color:var(--border) var(--bg-secondary);"></div>
        <div style="flex-shrink:0;border-top:1px solid var(--border);">
          <button id="mp-add-btn" style="display:block;width:100%;padding:10px 12px;border:none;
                  background:transparent;color:var(--text-muted);font-family:var(--font-mono);
                  font-size:10px;cursor:pointer;text-align:left;transition:all 0.15s;"
                  onmouseover="this.style.background='var(--accent-dim)';this.style.color='var(--accent)'"
                  onmouseout="this.style.background='transparent';this.style.color='var(--text-muted)'">
            + ADD MEDIA</button>
        </div>
      </div>

      <!-- Main area -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;height:100%;">

        <!-- display area: image/video live here, audio shows art panel -->
        <div id="mp-display" style="flex:1;min-height:0;display:flex;align-items:center;
                                    justify-content:center;background:#000;overflow:hidden;
                                    position:relative;">
          <div id="mp-placeholder" style="display:flex;flex-direction:column;align-items:center;
               gap:12px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">
            <span style="font-size:40px;">🎬</span>SELECT MEDIA FROM LIBRARY
          </div>
        </div>

        <!-- Audio art/info panel — only visible for audio -->
        <div id="mp-audio-panel" style="display:none;flex-direction:column;align-items:center;
             justify-content:center;gap:16px;padding:32px 24px;background:var(--bg-secondary);
             border-top:1px solid var(--border);flex-shrink:0;">
          <div id="mp-art" style="width:120px;height:120px;background:var(--bg-panel);
               border:1px solid var(--border);display:flex;align-items:center;justify-content:center;
               font-size:48px;flex-shrink:0;">🎵</div>
          <div style="text-align:center;min-width:0;width:100%;">
            <div id="mp-audio-title" style="font-family:var(--font-display);font-size:13px;
                 color:var(--text-primary);letter-spacing:0.1em;
                 white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            <div id="mp-audio-artist" style="font-family:var(--font-mono);font-size:10px;
                 color:var(--text-muted);margin-top:4px;"></div>
          </div>
          <!-- visualiser bars -->
          <div id="mp-vis" style="display:flex;align-items:flex-end;gap:3px;height:32px;opacity:0;transition:opacity 0.3s;">
            ${Array.from({length:20},(_,i)=>`<div class="mp-vis-bar" data-i="${i}"
              style="width:6px;background:var(--accent);border-radius:1px 1px 0 0;height:4px;
              transition:height 0.1s ease;opacity:${0.4+i*0.03};"></div>`).join('')}
          </div>
        </div>

        <!-- Playback controls — only shown for audio/video, hidden for images -->
        <div id="mp-controls" style="display:none;flex-shrink:0;padding:10px 14px;
             border-top:1px solid var(--border);background:var(--bg-secondary);
             flex-direction:column;gap:6px;">
          <!-- seek row -->
          <div style="display:flex;align-items:center;gap:8px;">
            <span id="mp-cur" style="font-family:var(--font-mono);font-size:9px;
                  color:var(--text-muted);min-width:36px;">0:00</span>
            <input id="mp-seek" type="range" min="0" max="100" value="0"
              style="flex:1;accent-color:var(--accent);cursor:pointer;height:4px;"/>
            <span id="mp-dur" style="font-family:var(--font-mono);font-size:9px;
                  color:var(--text-muted);min-width:36px;text-align:right;">0:00</span>
          </div>
          <!-- buttons row -->
          <div style="display:flex;align-items:center;gap:6px;">
            <button class="media-ctrl-btn" id="mp-rew"  title="Rewind 10s">⏮</button>
            <button class="media-ctrl-btn" id="mp-pp"   title="Play/Pause" style="width:32px;">▶</button>
            <button class="media-ctrl-btn" id="mp-fwd"  title="Forward 10s">⏭</button>
            <button class="media-ctrl-btn" id="mp-mute" title="Mute">🔊</button>
            <input id="mp-vol" type="range" min="0" max="1" step="0.05" value="1"
              style="width:70px;accent-color:var(--accent);cursor:pointer;height:4px;"/>
            <span id="mp-info" style="margin-left:auto;font-family:var(--font-mono);
                  font-size:9px;color:var(--text-muted);white-space:nowrap;
                  overflow:hidden;text-overflow:ellipsis;max-width:200px;">NO FILE SELECTED</span>
          </div>
        </div>
      </div>`;

    // ── Element refs ─────────────────────────────────────────────────────
    const listEl      = container.querySelector('#mp-list');
    const displayEl   = container.querySelector('#mp-display');
    const placeholder = container.querySelector('#mp-placeholder');
    const audioPanel  = container.querySelector('#mp-audio-panel');
    const titleEl     = container.querySelector('#mp-audio-title');
    const artistEl    = container.querySelector('#mp-audio-artist');
    const visEl       = container.querySelector('#mp-vis');
    const controlsEl  = container.querySelector('#mp-controls');
    const seekEl      = container.querySelector('#mp-seek');
    const curEl       = container.querySelector('#mp-cur');
    const durEl       = container.querySelector('#mp-dur');
    const ppBtn       = container.querySelector('#mp-pp');
    const rewBtn      = container.querySelector('#mp-rew');
    const fwdBtn      = container.querySelector('#mp-fwd');
    const muteBtn     = container.querySelector('#mp-mute');
    const volEl       = container.querySelector('#mp-vol');
    const infoEl      = container.querySelector('#mp-info');
    const addBtn      = container.querySelector('#mp-add-btn');

    // ── Visualiser ────────────────────────────────────────────────────────
    let visInterval = null;
    function startVis() {
      visEl.style.opacity = '1';
      visInterval = setInterval(() => {
        visEl.querySelectorAll('.mp-vis-bar').forEach(b => {
          const h = activeMedia && !activeMedia.paused ? (4 + Math.random() * 28) : 4;
          b.style.height = h + 'px';
        });
      }, 120);
    }
    function stopVis() {
      clearInterval(visInterval);
      visEl.querySelectorAll('.mp-vis-bar').forEach(b => b.style.height = '4px');
      visEl.style.opacity = '0';
    }

    // ── Bind playback controls ────────────────────────────────────────────
    function bindControls(el) {
      activeMedia = el;
      ppBtn.textContent = '▶';
      seekEl.value = 0; curEl.textContent = '0:00'; durEl.textContent = '0:00';

      ppBtn.onclick  = () => { el.paused ? el.play() : el.pause(); };
      rewBtn.onclick = () => { el.currentTime = Math.max(0, el.currentTime - 10); };
      fwdBtn.onclick = () => { el.currentTime = Math.min(el.duration || 0, el.currentTime + 10); };
      muteBtn.onclick = () => { el.muted = !el.muted; muteBtn.textContent = el.muted ? '🔇' : '🔊'; };
      volEl.oninput  = () => { el.volume = parseFloat(volEl.value); };
      seekEl.oninput = () => { if (el.duration) el.currentTime = (parseFloat(seekEl.value) / 100) * el.duration; };

      el.addEventListener('play',  () => { ppBtn.textContent = '⏸'; startVis(); });
      el.addEventListener('pause', () => { ppBtn.textContent = '▶'; stopVis(); });
      el.addEventListener('ended', () => { ppBtn.textContent = '▶'; stopVis(); });
      el.addEventListener('loadedmetadata', () => { durEl.textContent = fmtTime(el.duration); });
      el.addEventListener('timeupdate', () => {
        if (el.duration) seekEl.value = (el.currentTime / el.duration) * 100;
        curEl.textContent = fmtTime(el.currentTime);
      });
    }

    function parseAudioMeta(name) {
      const base = name.replace(/\.[^.]+$/, '');
      const parts = base.split(' - ');
      if (parts.length >= 2) return { title: parts.slice(1).join(' - ').trim(), artist: parts[0].trim() };
      return { title: base, artist: 'Unknown Artist' };
    }

    // ── Render a selected item ────────────────────────────────────────────
    function renderItem(item) {
      // Stop and fully tear down previous media
      if (activeMedia) {
        activeMedia.pause();
        activeMedia.src = '';
        activeMedia.load();
        activeMedia = null;
      }
      stopVis();

      // Clear ALL child elements from display except placeholder
      Array.from(displayEl.children).forEach(child => {
        if (child.id !== 'mp-placeholder') child.remove();
      });

      // Reset UI panels
      placeholder.style.display = 'none';
      audioPanel.style.display  = 'none';
      controlsEl.style.display  = 'none';
      infoEl.textContent        = item.name;

      if (item.type === 'image') {
        // Image: just show it, no controls needed
        displayEl.style.background = '#000';
        const img = document.createElement('img');
        img.src = item.src;
        img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;display:block;';
        img.onerror = () => { img.replaceWith(Object.assign(document.createElement('div'), {
          textContent: 'Image could not be loaded',
          style: 'color:var(--text-muted);font-family:var(--font-mono);font-size:11px;'
        })); };
        displayEl.appendChild(img);
        // No controls for images

      } else if (item.type === 'video') {
        displayEl.style.background = '#000';
        const vid = document.createElement('video');
        vid.src = item.src;
        vid.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        vid.preload = 'metadata';
        displayEl.appendChild(vid);
        // Show controls
        controlsEl.style.display = 'flex';
        bindControls(vid);

      } else if (item.type === 'audio') {
        displayEl.style.background = 'var(--bg-panel)';
        audioPanel.style.display   = 'flex';

        const meta = parseAudioMeta(item.name);
        titleEl.textContent  = meta.title;
        artistEl.textContent = meta.artist || '';

        const aud = document.createElement('audio');
        aud.src     = item.src;
        aud.preload = 'metadata';
        // Keep audio element off-screen but in DOM for playback
        aud.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
        displayEl.appendChild(aud);
        // Show controls
        controlsEl.style.display = 'flex';
        bindControls(aud);

      } else {
        // Unknown type
        displayEl.style.background = 'var(--bg-panel)';
        const msg = document.createElement('div');
        msg.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;';
        msg.innerHTML = `<span style="font-size:40px;">📦</span>Cannot preview this file type`;
        displayEl.appendChild(msg);
      }
    }

    // ── Render sidebar list ───────────────────────────────────────────────
    function renderList() {
      const all = getMediaList();
      if (all.length === 0) {
        listEl.innerHTML = `<div style="padding:12px;font-family:var(--font-mono);font-size:10px;
          color:var(--text-muted);">No media in /home/media<br><span style="font-size:9px;opacity:0.6;">Click + ADD MEDIA below</span></div>`;
        return;
      }
      const typeIcon = { video:'🎬', audio:'🎵', image:'🖼️', unknown:'📄' };
      listEl.innerHTML = all.map((m, i) => `
        <div class="media-item${i === currentIdx ? ' active' : ''}"
             style="cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--border);
                    font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);
                    transition:all 0.15s;user-select:none;" data-idx="${i}">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="flex-shrink:0;">${typeIcon[m.type]||'📄'}</span>
            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</span>
          </div>
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;">${m.type}</div>
        </div>`).join('');

      listEl.querySelectorAll('.media-item').forEach(el => {
        el.addEventListener('mouseenter', () => { if (parseInt(el.dataset.idx) !== currentIdx) el.style.background = 'var(--accent-dim)'; el.style.color = 'var(--accent)'; });
        el.addEventListener('mouseleave', () => { if (parseInt(el.dataset.idx) !== currentIdx) { el.style.background = ''; el.style.color = 'var(--text-secondary)'; } });
        el.addEventListener('click', () => {
          const prev = listEl.querySelector('.media-item.active');
          if (prev) { prev.classList.remove('active'); prev.style.background = ''; prev.style.color = 'var(--text-secondary)'; }
          currentIdx = parseInt(el.dataset.idx);
          el.classList.add('active');
          el.style.background = 'var(--accent-dim)';
          el.style.color = 'var(--accent)';
          renderItem(all[currentIdx]);
        });
      });
    }

    // ── Add media button ──────────────────────────────────────────────────
    addBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*,video/*,audio/*';
      input.multiple = true;
      input.onchange = e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        let done = 0;
        files.forEach(file => {
          const reader = new FileReader();
          reader.onload = ev => {
            const fs = fsGet();
            fs['/home/media/' + file.name] = ev.target.result;
            fsSet(fs);
            done++;
            if (done === files.length) {
              renderList();
              StrataOS.showToast(`Added ${done} file${done !== 1 ? 's' : ''} to /home/media`, 'success');
            }
          };
          reader.onerror = () => {
            done++;
            StrataOS.showToast(`Failed to load: ${file.name}`, 'error');
            if (done === files.length) renderList();
          };
          // Always use readAsDataURL for media files — readAsText corrupts binary
          reader.readAsDataURL(file);
        });
      };
      input.click();
    });

    renderList();

    // If called with a pre-selected path (from file explorer), open it
    if (openPath) {
      const all = getMediaList();
      const idx = all.findIndex(m => m.name === openPath.split('/').pop());
      if (idx >= 0) {
        currentIdx = idx;
        renderItem(all[idx]);
        // Scroll list to selected item
        requestAnimationFrame(() => {
          const el = listEl.querySelector(`[data-idx="${idx}"]`);
          if (el) el.scrollIntoView({ block: 'nearest' });
        });
      }
    }
  }

  // ── FILE EXPLORER ────────────────────────────────────────────────────────

  function buildFileExplorer(container) {
    const isIT = Auth.hasScope('NETTECH') || Auth.hasScope('SITEAUTHORITY');

    const baseDirs = [
      { path: '/home/desktop',   label: '🖥️ Desktop',   icon: '🖥️' },
      { path: '/home/downloads', label: '⬇️ Downloads',  icon: '⬇️' },
      { path: '/home/documents', label: '📄 Documents',  icon: '📄' },
      { path: '/home/media',     label: '🎬 Media',      icon: '🎬' },
    ];
    const itDirs = [
      { path: '/system',        label: '⚙️ System',        icon: '⚙️', readonly: true },
      { path: '/proxy',         label: '🔒 Proxy',         icon: '🔒', readonly: true },
      { path: '/kernel',        label: '🧩 Kernel',        icon: '🧩', readonly: true },
      { path: '/archive-proxy', label: '🗄️ Archive Proxy', icon: '🗄️', readonly: true },
    ];

    const allDirs = isIT ? [...baseDirs, ...itDirs] : baseDirs;
    let currentPath = '/home/desktop';

    function listFiles(path) {
      return Object.entries(fsGet()).filter(([k]) => {
        const parent = k.replace(/\/[^/]+$/, '') || '/';
        return parent === path;
      });
    }

    // Open a file in the appropriate app based on its type
    function openFile(path) {
      const name = path.split('/').pop();
      const type = fileTypeOf(name);
      const files = fsGet();

      if (type === 'image' || type === 'video' || type === 'audio') {
        // Copy to /home/media if not already there, then open media player
        const mediaPath = '/home/media/' + name;
        if (!files[mediaPath] && files[path]) {
          files[mediaPath] = files[path];
          fsSet(files);
        }
        Desktop.openMediaPlayer(path);
      } else if (type === 'text') {
        // Open in text editor with content
        const content = files[path];
        Desktop.openTextEditor(name, content);
      } else {
        // Unknown — attempt to open in text editor as fallback
        const content = files[path];
        if (typeof content === 'string' && !content.startsWith('data:')) {
          Desktop.openTextEditor(name, content);
        } else {
          StrataOS.showToast(`Cannot open: unknown or binary file type`, 'warn');
        }
      }
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
        </div>`).join('') + (isIT ? `
        <div class="file-tree-sep"></div>
        <div style="padding:6px 14px;font-family:var(--font-mono);font-size:8px;
                    color:var(--text-muted);letter-spacing:0.1em;">IT ACCESS (READ-ONLY)</div>` : '');

      const files   = listFiles(currentPath);
      const dir     = allDirs.find(d => d.path === currentPath);
      const isReadOnly = dir?.readonly || false;

      if (files.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;font-family:var(--font-mono);font-size:11px;
          color:var(--text-muted);padding:20px;">
          ${isReadOnly ? '[ READ-ONLY — SYSTEM FILES PROTECTED ]' : '(empty folder)'}</div>`;
      } else {
        grid.innerHTML = files.map(([path]) => {
          const name = path.split('/').pop();
          const type = fileTypeOf(name);
          const icon = fileIcon(name);
          // Type label colour
          const typeColor = {
            text: 'var(--text-muted)',
            image: 'var(--accent)',
            video: '#a060ff',
            audio: 'var(--success)',
            unknown: 'var(--warning)'
          }[type] || 'var(--text-muted)';

          return `<div class="file-icon" data-path="${path}" data-type="${type}"
                    ${!isReadOnly ? `ondblclick="feOpenFile('${path}')"` : ''}
                    title="${isReadOnly ? 'Read-only' : 'Double-click to open — ' + type}">
                    <div class="file-icon-glyph">${icon}</div>
                    <div class="file-icon-name">${name}</div>
                    <div style="font-family:var(--font-mono);font-size:8px;color:${typeColor};
                                text-transform:uppercase;letter-spacing:0.05em;margin-top:1px;">${type}</div>
                  </div>`;
        }).join('');
      }

      // Right-click on file icons
      if (!isReadOnly) {
        grid.querySelectorAll('.file-icon[data-path]').forEach(el => {
          el.addEventListener('contextmenu', e => {
            e.preventDefault();
            const path = el.dataset.path;
            const name = path.split('/').pop();
            const type = fileTypeOf(name);
            const canEdit = type === 'text' || type === 'unknown';
            const canMedia = type === 'image' || type === 'video' || type === 'audio';

            const menuItems = [
              { icon: '📂', label: 'Open', action: () => openFile(path) },
            ];

            if (canMedia) {
              menuItems.push({ icon: '🎬', label: 'Open in Media Player', action: () => {
                const fs = fsGet();
                const mediaPath = '/home/media/' + name;
                if (!fs[mediaPath] && fs[path]) { fs[mediaPath] = fs[path]; fsSet(fs); }
                Desktop.openMediaPlayer(path);
              }});
            }
            if (canEdit || type === 'unknown') {
              menuItems.push({ icon: '📝', label: 'Open in Text Editor', action: () => {
                const fs = fsGet();
                Desktop.openTextEditor(name, fs[path] || '');
              }});
            }

            menuItems.push(
              'sep',
              { icon: '✏️', label: 'Rename', action: async () => {
                const newName = await showRenameModal(name);
                if (!newName || newName === name) return;
                const result = fsRename(path, newName);
                if (result) { StrataOS.showToast(`Renamed to ${newName}`, 'success'); render(); }
              }},
              { icon: '📋', label: 'Copy', action: () => {
                const files = fsGet();
                clipboard = { op: 'copy', path, name, content: files[path] };
                StrataOS.showToast(`Copied: ${name}`, 'success');
              }},
              { icon: '✂️', label: 'Cut', action: () => {
                const files = fsGet();
                clipboard = { op: 'cut', path, name, content: files[path] };
                StrataOS.showToast(`Cut: ${name}`, 'success');
              }},
              { icon: '📁', label: 'Move to…', action: async () => {
                const dest = await showMovePicker(name);
                if (!dest || dest === currentPath) return;
                const result = fsMove(path, dest);
                if (result) { StrataOS.showToast(`Moved to ${dest}`, 'success'); render(); }
              }},
              'sep',
              { icon: '🗑️', label: 'Delete', danger: true, action: async () => {
                const ok = await showConfirmModal(`Delete <b>${name}</b>? This cannot be undone.`);
                if (ok) { fsDelete(path); StrataOS.showToast(`Deleted: ${name}`, 'warn'); render(); }
              }}
            );

            showContextMenu(e.clientX, e.clientY, menuItems);
          });
        });
      }

      // Right-click on empty grid area (paste)
      grid.addEventListener('contextmenu', e => {
        if (e.target.closest('.file-icon')) return;
        if (isReadOnly) return;
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { icon: '📌', label: 'Paste', disabled: !clipboard, action: () => {
            if (!clipboard) return;
            if (clipboard.op === 'copy') {
              fsCopy(clipboard.path, currentPath);
              StrataOS.showToast(`Pasted copy: ${clipboard.name}`, 'success');
            } else {
              const result = fsMove(clipboard.path, currentPath);
              if (result) { StrataOS.showToast(`Pasted (moved): ${clipboard.name}`, 'success'); clipboard = null; }
            }
            render();
          }},
          { icon: '🔄', label: 'Refresh', action: () => render() },
        ]);
      });
    }

    container.innerHTML = `
      <div class="file-explorer full">
        <div class="file-tree" id="fe-tree"></div>
        <div class="file-main">
          <div style="display:flex;align-items:center;border-bottom:1px solid var(--border);
                      background:var(--bg-secondary);flex-shrink:0;">
            <div class="file-breadcrumb" id="fe-breadcrumb"
                 style="flex:1;border-bottom:none;">/home/desktop</div>
            <button onclick="feImport()" style="padding:4px 12px;margin:4px 4px 4px 0;
                    border:1px solid var(--border);background:transparent;color:var(--text-muted);
                    font-family:var(--font-mono);font-size:10px;cursor:pointer;transition:all 0.2s;white-space:nowrap;"
                    onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                    onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
              ⬆ IMPORT</button>
            <button onclick="feRefresh()" style="padding:4px 12px;margin:4px 8px 4px 0;
                    border:1px solid var(--border);background:transparent;color:var(--text-muted);
                    font-family:var(--font-mono);font-size:10px;cursor:pointer;transition:all 0.2s;"
                    onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
                    onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
              🔄</button>
          </div>
          <div class="file-grid" id="fe-grid"></div>
        </div>
      </div>`;

    window.feDirClick = function(path) { currentPath = path; render(); };

    window.feOpenFile = function(path) {
      openFile(path);
    };

    window.feRefresh = function() { render(); };

    window.feImport = function() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '*/*';
      input.multiple = true;
      input.onchange = async e => {
        const files  = Array.from(e.target.files);
        const stored = fsGet();
        let count = 0;
        let skipped = 0;

        const readFile = (file) => new Promise(res => {
          const type = fileTypeOf(file.name);
          const useBinary = type === 'image' || type === 'audio' || type === 'video';

          // Skip truly binary/executable files that aren't media
          if (!useBinary && type === 'unknown') {
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const binaryExts = ['exe','dll','bin','so','dylib','class','pyc','wasm','zip','tar','gz','7z','rar','pdf','doc','docx','xls','xlsx','ppt','pptx','db','sqlite'];
            if (binaryExts.includes(ext)) {
              skipped++;
              res();
              return;
            }
          }

          const reader = new FileReader();
          reader.onload = ev => {
            const destPath = currentPath + '/' + file.name;
            stored[destPath] = ev.target.result;
            count++;
            res();
          };
          reader.onerror = () => { skipped++; res(); };

          if (useBinary) {
            reader.readAsDataURL(file);
          } else {
            reader.readAsText(file);
          }
        });

        // Process files sequentially to avoid freezing
        for (const file of files) {
          await readFile(file);
        }

        fsSet(stored);
        render();
        const msg = skipped > 0
          ? `Imported ${count} file${count !== 1 ? 's' : ''}, skipped ${skipped} unsupported`
          : `Imported ${count} file${count !== 1 ? 's' : ''} to ${currentPath}`;
        StrataOS.showToast(msg, skipped > 0 ? 'warn' : 'success');
      };
      input.click();
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
      else { expr += val; result = expr; }
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

    container.addEventListener('keydown', e => {
      const map = {'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        '+':'+','-':'−','*':'×','/':'÷','.':'.','Enter':'=','Backspace':'⌫','Escape':'C','%':'%'};
      if (map[e.key]) pressBtn(map[e.key]);
    });
    container.setAttribute('tabindex','0');
  }

  // ── ARCHIVE WRITER ──────────────────────────────────────────────────────

  function buildArchiveWriter(container) {
    const CONTAIN_CLASSES   = ['Safe','Euclid','Keter','Neutralized','Pending','Explained','Esoteric'];
    const SECONDARY_CLASSES = ['None','Apollyon','Archon','Cernunnos','Decommissioned','Hiemal',
      'Tiamat','Ticonderoga','Thaumiel','Uncontained'];
    const DISRUPTION = ['Dark','Vlam','Keneq','Ekhi','Amida'];
    const RISK       = ['Notice','Caution','Warning','Danger','Critical'];
    const CLEARANCE_LEVELS = [
      {val:1,label:'1 — Unrestricted'},{val:2,label:'2 — Restricted'},
      {val:3,label:'3 — Confidential'},{val:4,label:'4 — Secret'},
      {val:5,label:'5 — Top Secret'},{val:6,label:'6 — Cosmic Top Secret'},
    ];

    const DISRUPTION_COLORS = {Dark:'var(--cl-1)',Vlam:'var(--cl-2)',Keneq:'var(--cl-3)',Ekhi:'var(--cl-4)',Amida:'var(--cl-5)'};
    const RISK_COLORS       = {Notice:'var(--cl-1)',Caution:'var(--cl-2)',Warning:'var(--cl-3)',Danger:'var(--cl-4)',Critical:'var(--cl-5)'};
    const CONTAIN_COLORS    = {Safe:'var(--cl-1)',Euclid:'var(--cl-3)',Keter:'var(--cl-5)',
      Neutralized:'#888',Pending:'#888',Explained:'#888',Esoteric:'#888'};

    container.style.display       = 'flex';
    container.style.flexDirection = 'column';
    container.style.height        = '100%';
    container.style.overflow      = 'hidden';

    container.innerHTML = `
      <div class="archive-writer" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
        <div class="archive-toolbar">
          <span class="archive-toolbar-title">ARCHIVE WRITER — FOUNDATION DOCUMENT SYSTEM</span>
          <button class="editor-btn" onclick="archiveSave()">SAVE (SESSION)</button>
          <button class="editor-btn" onclick="archiveExport()">EXPORT .TXT</button>
          <button class="editor-btn" onclick="archiveClear()">NEW DOCUMENT</button>
        </div>
        <div class="archive-body" id="archive-body">

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

          <div id="acs-hint-block" style="border:1px solid var(--border);padding:12px 16px;
            background:var(--bg-secondary);font-family:var(--font-mono);font-size:10px;
            color:var(--text-muted);line-height:1.7;">
            <span style="color:var(--accent);">CLASSIFICATION GUIDE</span><br>
            <b style="color:var(--text-secondary);">Containment:</b> Safe · Euclid · Keter · Neutralized · Esoteric<br>
            <b style="color:var(--text-secondary);">Disruption:</b> Dark → Vlam → Keneq → Ekhi → Amida<br>
            <b style="color:var(--text-secondary);">Risk:</b> Notice → Caution → Warning → Danger → Critical
          </div>

          <div>
            <div class="section-label">SPECIAL CONTAINMENT PROCEDURES</div>
            <textarea class="archive-content-area" id="aw-scp" rows="5"
              placeholder="Describe containment procedures…"></textarea>
          </div>
          <div>
            <div class="section-label">DESCRIPTION</div>
            <textarea class="archive-content-area" id="aw-desc" rows="8"
              placeholder="Describe the anomaly…"></textarea>
          </div>
          <div>
            <div class="section-label">ADDENDA / INCIDENT LOGS (OPTIONAL)</div>
            <textarea class="archive-content-area" id="aw-addenda" rows="6"
              placeholder="Supplemental logs…"></textarea>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="archive-save-btn" onclick="archiveSave()">SAVE TO SESSION</button>
            <button class="archive-save-btn" onclick="archiveExport()">EXPORT AS .TXT</button>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:auto;">
              Session-only unless exported.</span>
          </div>
        </div>
      </div>`;

    ['aw-scp','aw-desc','aw-addenda'].forEach(id => {
      const el = container.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('contextmenu', e => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY, [
          { icon: '✂️', label: 'Cut',   action: () => document.execCommand('cut')   },
          { icon: '📋', label: 'Copy',  action: () => document.execCommand('copy')  },
          { icon: '📌', label: 'Paste', action: () => document.execCommand('paste') },
          'sep',
          { icon: '🗑️', label: 'Clear field', danger: true, action: async () => {
            const ok = await showConfirmModal(`Clear this field?`);
            if (ok) el.value = '';
          }},
        ]);
      });
    });

    window.awUpdate = function() {
      const item      = document.getElementById('aw-item')?.value     || 'SCP-XXXX';
      const clearance = document.getElementById('aw-clearance')?.value || '1';
      const contain   = document.getElementById('aw-contain')?.value   || 'Safe';
      const secondary = document.getElementById('aw-secondary')?.value || 'None';
      const disrupt   = document.getElementById('aw-disruption')?.value|| 'Dark';
      const risk      = document.getElementById('aw-risk')?.value      || 'Notice';

      document.getElementById('acs-prev-item').textContent       = item;
      document.getElementById('acs-prev-clearance').textContent  = clearance;
      document.getElementById('acs-prev-contain').textContent    = contain.toUpperCase();
      document.getElementById('acs-prev-secondary').textContent  = secondary === 'None' ? '—' : secondary.toUpperCase();
      document.getElementById('acs-prev-disruption').textContent = disrupt.toUpperCase();
      document.getElementById('acs-prev-risk').textContent       = risk.toUpperCase();

      const cellContain = document.getElementById('acs-cell-contain');
      const cellDisrupt = document.getElementById('acs-cell-disruption');
      const cellRisk    = document.getElementById('acs-cell-risk');
      if (cellContain) { cellContain.style.background = CONTAIN_COLORS[contain]    || '#888'; cellContain.style.color = '#fff'; }
      if (cellDisrupt) { cellDisrupt.style.background = DISRUPTION_COLORS[disrupt] || '#888'; cellDisrupt.style.color = '#fff'; }
      if (cellRisk)    { cellRisk.style.background    = RISK_COLORS[risk]           || '#888'; cellRisk.style.color    = '#fff'; }
    };

    window.archiveSave = function() {
      const item = document.getElementById('aw-item')?.value || 'untitleddoc';
      const doc  = buildArchiveDoc();
      const files = fsGet();
      files[`/home/documents/${item}.txt`] = doc;
      fsSet(files);
      StrataOS.showToast(`Saved: ${item}.txt`, 'success');
    };

    window.archiveExport = function() {
      const item = document.getElementById('aw-item')?.value || 'untitleddoc';
      const doc  = buildArchiveDoc();
      const blob = new Blob([doc], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${item}.txt`;
      a.click();
    };

    window.archiveClear = async function() {
      const ok = await showConfirmModal('Clear all fields and start a new document?');
      if (!ok) return;
      ['aw-item','aw-title','aw-author','aw-scp','aw-desc','aw-addenda'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('aw-date').value = new Date().toISOString().split('T')[0];
      awUpdate();
    };

    function buildArchiveDoc() {
      const item      = document.getElementById('aw-item')?.value      || 'SCP-XXXX';
      const title     = document.getElementById('aw-title')?.value     || '';
      const author    = document.getElementById('aw-author')?.value    || '';
      const date      = document.getElementById('aw-date')?.value      || '';
      const clearance = document.getElementById('aw-clearance')?.value || '1';
      const contain   = document.getElementById('aw-contain')?.value   || 'Safe';
      const secondary = document.getElementById('aw-secondary')?.value || 'None';
      const disrupt   = document.getElementById('aw-disruption')?.value|| 'Dark';
      const risk      = document.getElementById('aw-risk')?.value      || 'Notice';
      const scp       = document.getElementById('aw-scp')?.value       || '';
      const desc      = document.getElementById('aw-desc')?.value      || '';
      const addenda   = document.getElementById('aw-addenda')?.value   || '';
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
        addenda ? '\n' + '─'.repeat(70) + '\nADDENDA\n' + '─'.repeat(70) + '\n' + addenda : '',
        '',
        '═'.repeat(70),
        `END OF DOCUMENT — ${item}`,
        '═'.repeat(70),
      ].filter(l => l !== '').join('\n');
    }

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