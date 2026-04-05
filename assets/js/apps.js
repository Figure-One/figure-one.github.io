// === APPS.JS — STRATA OS APPLICATION LAYER ===

const Apps = (() => {

  // ── CLIPBOARD (cut/copy/paste across apps) ──────────────────────────────
  let clipboard = null; // { op: 'copy'|'cut', path, name, content }

  // ── BLOB STORE — in-memory store for binary files (images/audio/video) ──
  // sessionStorage has a ~5 MB quota; base64-encoded media blows past it instantly.
  // We keep binary file data in a plain Map for the session lifetime instead.
  const blobStore = new Map(); // path → dataURL string

  function blobGet(path)        { return blobStore.get(path) ?? null; }
  function blobSet(path, data)  { blobStore.set(path, data); }
  function blobDelete(path)     { blobStore.delete(path); }
  function blobList()           { return Array.from(blobStore.entries()); } // [[path, dataURL], …]

  // Unified read: checks blobStore first, then sessionStorage
  function fileRead(path) {
    const blob = blobStore.get(path);
    if (blob !== undefined) return blob;
    const fs = fsGet();
    return fs[path] ?? null;
  }

  // Returns all known paths (both stores, deduplicated)
  function allPaths() {
    const fs = fsGet();
    const set = new Set([...Object.keys(fs), ...blobStore.keys()]);
    return Array.from(set);
  }

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
      case 'text':    return '<img src="/assets/icons/strata/file-text.png"  style="width:24px;height:24px;object-fit:contain;" alt="text"/>';
      case 'image':   return '<img src="/assets/icons/strata/file-image.png" style="width:24px;height:24px;object-fit:contain;" alt="image"/>';
      case 'video':   return '<img src="/assets/icons/strata/file-video.png" style="width:24px;height:24px;object-fit:contain;" alt="video"/>';
      case 'audio':   return '<img src="/assets/icons/strata/file-audio.png" style="width:24px;height:24px;object-fit:contain;" alt="audio"/>';
      default:        return '<img src="/assets/icons/strata/file-unknown.png" style="width:24px;height:24px;object-fit:contain;" alt="file"/>';
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

  // sessionStorage only holds text files — binary data lives in blobStore
  function fsGet()      { return JSON.parse(sessionStorage.getItem('fs_files') || '{}'); }
  function fsSet(files) {
    try { sessionStorage.setItem('fs_files', JSON.stringify(files)); }
    catch(e) { /* quota exceeded — binary files must use blobStore instead */ }
  }

  // Unified read: blob store first, then sessionStorage
  function fileRead(path) {
    if (blobStore.has(path)) return blobStore.get(path);
    return fsGet()[path] ?? null;
  }

  // All known paths across both stores
  function allPaths() {
    const set = new Set([...Object.keys(fsGet()), ...blobStore.keys()]);
    return Array.from(set);
  }

  function fsRename(oldPath, newName) {
    const dir     = oldPath.replace(/\/[^/]+$/, '');
    const newPath = dir + '/' + newName;
    if (blobStore.has(newPath) || fsGet()[newPath] !== undefined) {
      StrataOS.showToast('A file with that name already exists', 'error'); return false;
    }
    if (blobStore.has(oldPath)) {
      blobStore.set(newPath, blobStore.get(oldPath));
      blobStore.delete(oldPath);
    } else {
      const files = fsGet();
      files[newPath] = files[oldPath];
      delete files[oldPath];
      fsSet(files);
    }
    return newPath;
  }

  function fsDelete(path) {
    blobStore.delete(path);
    const files = fsGet();
    delete files[path];
    fsSet(files);
  }

  function fsMove(srcPath, destDir) {
    const name     = srcPath.split('/').pop();
    const destPath = destDir + '/' + name;
    if (blobStore.has(destPath) || fsGet()[destPath] !== undefined) {
      StrataOS.showToast('File already exists at destination', 'error'); return false;
    }
    if (blobStore.has(srcPath)) {
      blobStore.set(destPath, blobStore.get(srcPath));
      blobStore.delete(srcPath);
    } else {
      const files = fsGet();
      files[destPath] = files[srcPath];
      delete files[srcPath];
      fsSet(files);
    }
    return destPath;
  }

  function fsCopy(srcPath, destDir) {
    const name   = srcPath.split('/').pop();
    let destPath = destDir + '/' + name;
    if (blobStore.has(destPath) || fsGet()[destPath] !== undefined) {
      const ext  = name.includes('.') ? '.' + name.split('.').pop() : '';
      const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
      let i = 2;
      while (blobStore.has(destDir+'/'+base+'_copy'+(i>2?i:'')+ext) ||
             fsGet()[destDir+'/'+base+'_copy'+(i>2?i:'')+ext] !== undefined) i++;
      destPath = destDir + '/' + base + '_copy' + (i > 2 ? i : '') + ext;
    }
    if (blobStore.has(srcPath)) {
      blobStore.set(destPath, blobStore.get(srcPath));
    } else {
      const files = fsGet();
      files[destPath] = files[srcPath];
      fsSet(files);
    }
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
        const entries = allPaths().filter(k => {
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

    inEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const raw = inEl.value.trim();
        inEl.value = '';
        if (raw) Terminal.parseCommand(raw);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') {
        e.preventDefault();
        const fakeEvent = new KeyboardEvent('keydown', { key: e.key, bubbles: false });
        Terminal.handleKeyNav(fakeEvent);
      }
    });

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
      const src = fileRead(currentSavePath);
      if (src) area.value = src;
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
      const src = fileRead(result.path);
      if (src === null) { StrataOS.showToast(`File not found: ${result.name}`, 'error'); return; }
      area.value = src;
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
      const fromFs = allPaths()
        .filter(k => k.replace(/\/[^/]+$/, '') === '/home/media')
        .map(k => ({ name: k.split('/').pop(), src: fileRead(k), type: mediaTypeOf(k.split('/').pop()) }));
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
                                    justify-content:center;background:var(--bg-primary);overflow:hidden;
                                    position:relative;">
          <div id="mp-placeholder" style="display:flex;flex-direction:column;align-items:center;
               gap:12px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">
            <span style="font-size:40px;">🎬</span>SELECT MEDIA FROM LIBRARY
          </div>
        </div>

        <!-- Audio art/info panel — only visible for audio -->
        <div id="mp-audio-panel" style="display:none;flex-direction:column;align-items:center;
             justify-content:center;gap:16px;padding:32px 24px;background:var(--bg-secondary);
             border-top:1px solid var(--border);flex:1;min-height:0;overflow:hidden;">
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
      return { title: base, artist: '' };
    }

    function readAudioTags(src) {
      return new Promise(resolve => {
        const fallback = { title: null, artist: null, album: null, cover: null };
        if (!src || !src.startsWith('data:audio') || !window.jsmediatags) {
          resolve(fallback); return;
        }
        try {
          window.jsmediatags.read(dataURLtoBlob(src), {
            onSuccess: tag => {
              const t = tag.tags || {};
              let cover = null;
              if (t.picture) {
                const base64 = t.picture.data.reduce((s, b) => s + String.fromCharCode(b), '');
                cover = `data:${t.picture.format};base64,${btoa(base64)}`;
              }
              resolve({
                title:  t.title  || null,
                artist: t.artist || null,
                album:  t.album  || null,
                cover,
              });
            },
            onError: () => resolve(fallback)
          });
        } catch(e) { resolve(fallback); }
      });
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
      displayEl.style.display   = 'flex';
      controlsEl.style.display  = 'none';
      infoEl.textContent        = item.name;

      if (item.type === 'image') {
        // Image: just show it, no controls needed
        displayEl.style.background = 'var(--bg-primary)';
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
        displayEl.style.background = 'var(--bg-primary)';
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
        displayEl.style.display = 'none';
        audioPanel.style.display = 'flex';

        const fallbackMeta = parseAudioMeta(item.name);
        titleEl.textContent  = fallbackMeta.title;
        artistEl.textContent = '';

        const artEl = container.querySelector('#mp-art');
        artEl.innerHTML = '';
        artEl.style.cssText = 'width:120px;height:120px;background:var(--bg-panel);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;';
        artEl.appendChild(fallbackIcon('audio'));

        const aud = document.createElement('audio');
        aud.src     = item.src;
        aud.preload = 'metadata';
        aud.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;';
        displayEl.appendChild(aud);
        controlsEl.style.display = 'flex';
        bindControls(aud);

        // Read real tags async — update UI once resolved
        readAudioTags(item.src).then(tags => {
          if (tags.title)  titleEl.textContent  = tags.title;
          if (tags.artist) artistEl.textContent = tags.artist;
          else if (tags.album) artistEl.textContent = tags.album;

          if (tags.cover) {
            artEl.innerHTML = '';
            const img = document.createElement('img');
            img.src = tags.cover;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            img.onerror = () => { artEl.innerHTML = ''; artEl.appendChild(fallbackIcon('audio')); };
            artEl.appendChild(img);
          }
        });

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
    function extractCoverArt(src) {
      return readAudioTags(src).then(tags => tags.cover);
    }

    function makeIconEl(type, src) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:2px;';

      if (type === 'image' && src) {
        const img = document.createElement('img');
        img.src = src;
        img.style.cssText = 'width:32px;height:32px;object-fit:cover;';
        img.onerror = () => { img.replaceWith(fallbackIcon(type)); };
        wrap.appendChild(img);
      } else if (type === 'video' && src) {
        wrap.appendChild(fallbackIcon(type));
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';
        video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:160px;height:120px;pointer-events:none;';
        document.body.appendChild(video);

        const cleanup = () => {
          video.src = '';
          video.load();
          video.remove();
        };

        video.addEventListener('error', () => {
          cleanup();
        });

        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 32, 32);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            const img = document.createElement('img');
            img.src = dataUrl;
            img.style.cssText = 'width:32px;height:32px;object-fit:cover;';
            img.onerror = () => { img.replaceWith(fallbackIcon(type)); };
            wrap.innerHTML = '';
            wrap.appendChild(img);
          } catch(e) {
            // canvas tainted or draw failed — leave fallback
          }
          cleanup();
        });

        video.addEventListener('loadeddata', () => {
          video.currentTime = Math.min(1, (video.duration || 0) * 0.1 || 0.1);
        });

        video.src = src;
        video.load();
      } else {
        wrap.appendChild(fallbackIcon(type));
      }
      return wrap;
    }

    function fallbackIcon(type) {
      const img = document.createElement('img');
      const map = {
        audio: '/assets/icons/file-audio.png',
        video: '/assets/icons/file-video.png',
        image: '/assets/icons/file-image.png',
      };
      img.src = map[type] || '/assets/icons/file-unknown.png';
      img.style.cssText = 'width:24px;height:24px;object-fit:contain;';
      img.onerror = () => { img.style.display = 'none'; };
      return img;
    }

    async function renderList() {
      const all = getMediaList();
      if (all.length === 0) {
        listEl.innerHTML = `<div style="padding:12px;font-family:var(--font-mono);font-size:10px;
          color:var(--text-muted);">No media in /home/media<br><span style="font-size:9px;opacity:0.6;">Click + ADD MEDIA below</span></div>`;
        return;
      }

      // Build DOM items first with fallback icons, then swap in cover art async
      listEl.innerHTML = '';
      all.forEach((m, i) => {
        const item = document.createElement('div');
        item.className = 'media-item' + (i === currentIdx ? ' active' : '');
        item.dataset.idx = i;
        item.style.cssText = `cursor:pointer;padding:8px 12px;border-bottom:1px solid var(--border);
          font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);
          transition:all 0.15s;user-select:none;`;

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0;';

        const iconWrap = makeIconEl(m.type, (m.type === 'image' || m.type === 'video') ? m.src : null);
        iconWrap.dataset.iconIdx = i;

        const nameEl = document.createElement('span');
        nameEl.textContent = m.name;
        nameEl.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0;';

        const typeEl = document.createElement('div');
        typeEl.textContent = m.type;
        typeEl.style.cssText = 'font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-top:2px;';

        row.appendChild(iconWrap);
        row.appendChild(nameEl);
        item.appendChild(row);
        item.appendChild(typeEl);
        listEl.appendChild(item);

        item.addEventListener('mouseenter', () => {
          if (parseInt(item.dataset.idx) !== currentIdx) item.style.background = 'var(--accent-dim)';
          item.style.color = 'var(--accent)';
        });
        item.addEventListener('mouseleave', () => {
          if (parseInt(item.dataset.idx) !== currentIdx) { item.style.background = ''; item.style.color = 'var(--text-secondary)'; }
        });
        item.addEventListener('click', () => {
          const prev = listEl.querySelector('.media-item.active');
          if (prev) { prev.classList.remove('active'); prev.style.background = ''; prev.style.color = 'var(--text-secondary)'; }
          currentIdx = parseInt(item.dataset.idx);
          item.classList.add('active');
          item.style.background = 'var(--accent-dim)';
          item.style.color = 'var(--accent)';
          renderItem(all[currentIdx]);
        });
      });

      // Now async-swap cover art for audio items
      for (let i = 0; i < all.length; i++) {
        const m = all[i];
        if (m.type !== 'audio') continue;
        const coverSrc = await extractCoverArt(m.src);
        if (!coverSrc) continue;
        const iconWrap = listEl.querySelector(`[data-icon-idx="${i}"]`);
        if (!iconWrap) continue;
        iconWrap.innerHTML = '';
        const img = document.createElement('img');
        img.src = coverSrc;
        img.style.cssText = 'width:32px;height:32px;object-fit:cover;';
        img.onerror = () => { img.replaceWith(fallbackIcon('audio')); };
        iconWrap.appendChild(img);
      }
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
            // Always use blobStore for media — base64 blows past sessionStorage quota
            blobSet('/home/media/' + file.name, ev.target.result);
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
          reader.readAsDataURL(file);
        });
      };
      input.click();
    });

    renderList();

    function dataURLtoBlob(dataURL) {
      const [header, data] = dataURL.split(',');
      const mime = header.match(/:(.*?);/)[1];
      const binary = atob(data);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      return new Blob([arr], { type: mime });
    }

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
      return allPaths().filter(k => {
        const parent = k.replace(/\/[^/]+$/, '') || '/';
        return parent === path;
      }).map(k => [k, fileRead(k)]);
    }

    // Open a file in the appropriate app based on its type
    function openFile(path) {
      const name = path.split('/').pop();
      const type = fileTypeOf(name);

      if (type === 'image' || type === 'video' || type === 'audio') {
        // Mirror into /home/media (blobStore) if not already there
        const mediaPath = '/home/media/' + name;
        const src = fileRead(path);
        if (src && !blobStore.has(mediaPath)) {
          blobSet(mediaPath, src);
        }
        Desktop.openMediaPlayer(path);
      } else if (type === 'text') {
        const src = fileRead(path);
        Desktop.openTextEditor(name, src || '');
      } else {
        // Unknown — attempt text editor if it looks like text
        const src = fileRead(path);
        if (typeof src === 'string' && !src.startsWith('data:')) {
          Desktop.openTextEditor(name, src);
        } else {
          StrataOS.showToast('Cannot open: unknown or binary file type', 'warn');
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
                const mediaPath = '/home/media/' + name;
                const src = fileRead(path);
                if (src && !blobStore.has(mediaPath)) blobSet(mediaPath, src);
                Desktop.openMediaPlayer(path);
              }});
            }
            if (canEdit || type === 'unknown') {
              menuItems.push({ icon: '📝', label: 'Open in Text Editor', action: () => {
                Desktop.openTextEditor(name, fileRead(path) || '');
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
                clipboard = { op: 'copy', path, name, content: fileRead(path) };
                StrataOS.showToast(`Copied: ${name}`, 'success');
              }},
              { icon: '✂️', label: 'Cut', action: () => {
                clipboard = { op: 'cut', path, name, content: fileRead(path) };
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

          // Skip known binary formats that aren't viewable media
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
            if (useBinary) {
              // Binary media: store in memory (blobStore) — sessionStorage quota is too small
              blobSet(destPath, ev.target.result);
            } else {
              // Text files: safe to persist in sessionStorage
              stored[destPath] = ev.target.result;
            }
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

        // Process files sequentially to avoid blocking the main thread
        for (const file of files) {
          await readFile(file);
        }

        // Only persist text file changes to sessionStorage
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
    const CL_LABELS = {1:'Unrestricted',2:'Restricted',3:'Confidential',4:'Secret',5:'Top Secret',6:'Cosmic Top Secret'};

    container.style.cssText = 'display:flex;flex-direction:column;height:100%;overflow:hidden;';

    container.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%;overflow:hidden;">

        <!-- Toolbar -->
        <div class="archive-toolbar">
          <span class="archive-toolbar-title">ARCHIVE WRITER — FOUNDATION DOCUMENT SYSTEM</span>
          <button class="editor-btn" id="aw-btn-import">IMPORT</button>
          <button class="editor-btn" id="aw-btn-save">SAVE (SESSION)</button>
          <button class="editor-btn" id="aw-btn-export">EXPORT .TXT</button>
          <button class="editor-btn" id="aw-btn-clear">NEW DOCUMENT</button>
        </div>

        <!-- Scrollable body -->
        <div class="archive-body" id="archive-body">

          <!-- ACS Preview Bar -->
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

          <!-- Metadata row -->
          <div>
            <div class="section-label" style="margin-bottom:10px;">DOCUMENT METADATA</div>
            <div style="display:grid;grid-template-columns:1fr 2fr 1fr 1fr;gap:10px;width:100%;box-sizing:border-box;">
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

          <!-- ACS Classification row -->
          <div>
            <div class="section-label" style="margin-bottom:10px;">ACS CLASSIFICATION</div>
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;width:100%;box-sizing:border-box;">
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
                <label class="acs-label">Secondary Class</label>
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

          <!-- Classification guide -->
          <div style="border:1px solid var(--border);padding:10px 14px;
            background:var(--bg-secondary);font-family:var(--font-mono);font-size:10px;
            color:var(--text-muted);line-height:1.7;">
            <span style="color:var(--accent);">CLASSIFICATION GUIDE</span>
            &nbsp;·&nbsp; <b style="color:var(--text-secondary);">Containment:</b> Safe · Euclid · Keter · Neutralized · Esoteric
            &nbsp;·&nbsp; <b style="color:var(--text-secondary);">Disruption:</b> Dark → Vlam → Keneq → Ekhi → Amida
            &nbsp;·&nbsp; <b style="color:var(--text-secondary);">Risk:</b> Notice → Caution → Warning → Danger → Critical
          </div>

          <!-- SCP field -->
          <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
            <div class="section-label">SPECIAL CONTAINMENT PROCEDURES</div>
            <textarea class="archive-content-area" id="aw-scp"
              style="width:100%;box-sizing:border-box;min-height:120px;"
              placeholder="Describe containment procedures…"></textarea>
          </div>

          <!-- Description field -->
          <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
            <div class="section-label">DESCRIPTION</div>
            <textarea class="archive-content-area" id="aw-desc"
              style="width:100%;box-sizing:border-box;min-height:160px;"
              placeholder="Describe the anomaly…"></textarea>
          </div>

          <!-- Addenda field -->
          <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
            <div class="section-label">ADDENDA / INCIDENT LOGS (OPTIONAL)</div>
            <textarea class="archive-content-area" id="aw-addenda"
              style="width:100%;box-sizing:border-box;min-height:120px;"
              placeholder="Supplemental logs, interview transcripts, incident reports…"></textarea>
          </div>

          <!-- Footer actions -->
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-bottom:8px;">
            <button class="archive-save-btn" id="aw-foot-save">SAVE TO SESSION</button>
            <button class="archive-save-btn" id="aw-foot-export">EXPORT AS .TXT</button>
            <button class="archive-save-btn" id="aw-foot-import"
              style="border-color:var(--text-muted);color:var(--text-muted);">IMPORT FROM .TXT</button>
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-left:auto;">
              Output format: SCP Wiki (Wikidot). Session-only unless exported.</span>
          </div>

        </div>
      </div>`;

    // ── Context menus on textareas ────────────────────────────────────────
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
            const ok = await showConfirmModal('Clear this field?');
            if (ok) el.value = '';
          }},
        ]);
      });
    });

    // ── awUpdate — sync preview bar ───────────────────────────────────────
    window.awUpdate = function() {
      const item      = document.getElementById('aw-item')?.value      || 'SCP-XXXX';
      const clearance = document.getElementById('aw-clearance')?.value || '1';
      const contain   = document.getElementById('aw-contain')?.value   || 'Safe';
      const secondary = document.getElementById('aw-secondary')?.value || 'None';
      const disrupt   = document.getElementById('aw-disruption')?.value || 'Dark';
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

      // Hide secondary cell if None
      const secCell = document.getElementById('acs-cell-secondary');
      if (secCell) secCell.style.display = secondary === 'None' ? 'none' : '';
    };

    // ── buildArchiveDoc — Wikidot/SCP wiki format ─────────────────────────
    function buildArchiveDoc() {
      const item      = document.getElementById('aw-item')?.value      || 'SCP-XXXX';
      const title     = document.getElementById('aw-title')?.value     || '';
      const author    = document.getElementById('aw-author')?.value    || '';
      const date      = document.getElementById('aw-date')?.value      || '';
      const clearance = parseInt(document.getElementById('aw-clearance')?.value) || 1;
      const contain   = (document.getElementById('aw-contain')?.value  || 'Safe').toLowerCase();
      const secondary = document.getElementById('aw-secondary')?.value || 'None';
      const disrupt   = (document.getElementById('aw-disruption')?.value || 'Dark').toLowerCase();
      const risk      = (document.getElementById('aw-risk')?.value      || 'Notice').toLowerCase();
      const scp       = document.getElementById('aw-scp')?.value        || '';
      const desc      = document.getElementById('aw-desc')?.value       || '';
      const addenda   = document.getElementById('aw-addenda')?.value    || '';

      const hasSecondary = secondary !== 'None';
      const secLower = secondary.toLowerCase();

      // Build the [[include component:anomaly-class-bar-source ...]] block
      const acsLines = [
        `[[include :scp-wiki:component:anomaly-class-bar-source`,
        ``,
        `|item-number= ${item}`,
        ``,
        `|clearance= ${clearance}`,
        ``,
        `|container-class= ${contain}`,
        ``,
      ];
      if (hasSecondary) {
        acsLines.push(`|secondary-class= ${secLower}`);
        acsLines.push(``);
        acsLines.push(`|secondary-icon= http://scp-wiki.wdfiles.com/local--files/component%3Aanomaly-class-bar/${secLower}-icon.svg`);
        acsLines.push(``);
      } else {
        acsLines.push(`|secondary-class= none`);
        acsLines.push(``);
      }
      acsLines.push(`|disruption-class= ${disrupt}`);
      acsLines.push(``);
      acsLines.push(`|risk-class= ${risk}`);
      acsLines.push(``);
      acsLines.push(`]]`);

      const parts = [
        `[[>]]`,
        `[[module Rate]]`,
        `[[/>]]`,
        ``,
        acsLines.join('\n'),
        `----`,
        `**Item #:** ${item}${title ? ' — ' + title : ''}`,
        ``,
        `**Object Class:** ${contain.charAt(0).toUpperCase() + contain.slice(1)}${hasSecondary ? ' (' + secondary + ')' : ''}`,
        ``,
        `**Special Containment Procedures:** ${scp}`,
        ``,
        `**Description:** ${desc}`,
      ];

      if (addenda.trim()) {
        parts.push(``);
        parts.push(`----`);
        parts.push(``);
        parts.push(addenda);
      }

      // Footer metadata comment block
      parts.push(``);
      parts.push(`[[footnoteblock]]`);
      parts.push(``);
      parts.push(`[[div class="footer-wikiwalk-nav"]]`);
      parts.push(`[[=]]`);
      const num = item.replace(/[^0-9]/g, '');
      const prev = num ? `SCP-${parseInt(num)-1}` : 'SCP-PREV';
      const next = num ? `SCP-${parseInt(num)+1}` : 'SCP-NEXT';
      parts.push(`<< [[[${prev}]]] | ${item} | [[[${next}]]] >>`);
      parts.push(`[[/=]]`);
      parts.push(`[[/div]]`);

      if (author || date) {
        parts.push(``);
        parts.push(`<!-- Author: ${author} | Date: ${date} | Clearance: ${clearance} — ${CL_LABELS[clearance] || ''} -->`);
      }

      return parts.join('\n');
    }

    // ── parseArchiveDoc — parse Wikidot format back into fields ──────────
    function parseArchiveDoc(text) {
      const result = {
        item: '', title: '', author: '', date: '',
        clearance: '1', contain: 'Safe', secondary: 'None',
        disrupt: 'Dark', risk: 'Notice',
        scp: '', desc: '', addenda: ''
      };

      // ACS bar fields
      const extractACS = (key) => {
        const m = text.match(new RegExp(`\\|${key}=\\s*([^\\n|\\]]+)`));
        return m ? m[1].trim() : null;
      };

      const itemNum    = extractACS('item-number');
      const clearance  = extractACS('clearance');
      const container  = extractACS('container-class');
      const secondary  = extractACS('secondary-class');
      const disruption = extractACS('disruption-class');
      const riskC      = extractACS('risk-class');

      if (itemNum)    result.item      = itemNum;
      if (clearance)  result.clearance = clearance;
      if (container)  result.contain   = container.charAt(0).toUpperCase() + container.slice(1);
      if (secondary && secondary.toLowerCase() !== 'none') {
        result.secondary = secondary.charAt(0).toUpperCase() + secondary.slice(1);
      }
      if (disruption) result.disrupt = disruption.charAt(0).toUpperCase() + disruption.slice(1);
      if (riskC)      result.risk    = riskC.charAt(0).toUpperCase() + riskC.slice(1);

      // Item # and title from **Item #:** line
      const itemLine = text.match(/\*\*Item #:\*\*\s*([^\n—\-]+?)(?:\s*[—\-]+\s*(.+))?$/m);
      if (itemLine) {
        result.item  = itemLine[1].trim() || result.item;
        result.title = (itemLine[2] || '').trim();
      }

      // SCP procedures — everything after **Special Containment Procedures:** up to next **
      const scpM = text.match(/\*\*Special Containment Procedures:\*\*\s*([\s\S]*?)(?=\n\n\*\*Description:|$)/i);
      if (scpM) result.scp = scpM[1].trim();

      // Description — everything after **Description:** up to ---- or footnoteblock
      const descM = text.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\n----|\[\[footnoteblock\]\]|$)/i);
      if (descM) result.desc = descM[1].trim();

      // Addenda — between the ---- after description and [[footnoteblock]]
      const addendaM = text.match(/\*\*Description:\*\*[\s\S]*?\n----\n([\s\S]*?)(?=\[\[footnoteblock\]\]|$)/i);
      if (addendaM) result.addenda = addendaM[1].trim();

      // Author / date from comment
      const metaM = text.match(/<!--\s*Author:\s*([^|]*)\s*\|\s*Date:\s*([^|]*)\s*\|/);
      if (metaM) {
        result.author = metaM[1].trim();
        result.date   = metaM[2].trim();
      }

      return result;
    }

    // ── populateFields — fill form from parsed data ───────────────────────
    function populateFields(data) {
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };

      setVal('aw-item',      data.item);
      setVal('aw-title',     data.title);
      setVal('aw-author',    data.author);
      setVal('aw-date',      data.date);
      setVal('aw-clearance', data.clearance);

      // Dropdowns need case-insensitive match
      const matchOption = (id, val) => {
        const el = document.getElementById(id);
        if (!el || !val) return;
        const opt = Array.from(el.options).find(o => o.value.toLowerCase() === val.toLowerCase());
        if (opt) el.value = opt.value;
      };
      matchOption('aw-contain',   data.contain);
      matchOption('aw-secondary', data.secondary);
      matchOption('aw-disruption', data.disrupt);
      matchOption('aw-risk',      data.risk);

      setVal('aw-scp',     data.scp);
      setVal('aw-desc',    data.desc);
      setVal('aw-addenda', data.addenda);

      awUpdate();
    }

    // ── Import handler ────────────────────────────────────────────────────
    function doImport() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt,text/plain';
      input.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        const data = parseArchiveDoc(text);
        populateFields(data);
        StrataOS.showToast(`Imported: ${file.name}`, 'success');
      };
      input.click();
    }

    // ── Button wiring ─────────────────────────────────────────────────────
    container.querySelector('#aw-btn-import').addEventListener('click', doImport);
    container.querySelector('#aw-foot-import').addEventListener('click', doImport);

    const doSave = () => {
      const item = document.getElementById('aw-item')?.value || 'untitleddoc';
      const doc  = buildArchiveDoc();
      const files = fsGet();
      files[`/home/documents/${item}.txt`] = doc;
      fsSet(files);
      StrataOS.showToast(`Saved: ${item}.txt`, 'success');
    };

    const doExport = () => {
      const item = document.getElementById('aw-item')?.value || 'untitleddoc';
      const doc  = buildArchiveDoc();
      const blob = new Blob([doc], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${item}.txt`;
      a.click();
    };

    const doClear = async () => {
      const ok = await showConfirmModal('Clear all fields and start a new document?');
      if (!ok) return;
      ['aw-item','aw-title','aw-author','aw-scp','aw-desc','aw-addenda'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('aw-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('aw-clearance').value = '1';
      document.getElementById('aw-contain').value   = 'Safe';
      document.getElementById('aw-secondary').value = 'None';
      document.getElementById('aw-disruption').value = 'Dark';
      document.getElementById('aw-risk').value       = 'Notice';
      awUpdate();
    };

    container.querySelector('#aw-btn-save').addEventListener('click', doSave);
    container.querySelector('#aw-btn-export').addEventListener('click', doExport);
    container.querySelector('#aw-btn-clear').addEventListener('click', doClear);
    container.querySelector('#aw-foot-save').addEventListener('click', doSave);
    container.querySelector('#aw-foot-export').addEventListener('click', doExport);

    // Also expose globally for any inline callers that may remain
    window.archiveSave   = doSave;
    window.archiveExport = doExport;
    window.archiveClear  = doClear;

    awUpdate();
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