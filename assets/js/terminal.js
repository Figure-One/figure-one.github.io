// === TERMINAL.JS — STRATA OS TERMINAL ENGINE ===

const Terminal = (() => {

  let outputEl = null;
  let inputEl = null;
  let promptEl = null;
  let history = [];
  let historyIndex = -1;
  let locked = false; // locked during animations / login
  let theme = 'dark';
  let isDesktopTerminal = false; // true when running inside the desktop app window

  // Typing queue so lines appear sequentially
  let printQueue = Promise.resolve();

  // ── Print helpers ──────────────────────────────────────────────────────

  function printLine(text = '', cls = '', delay = 0) {
    printQueue = printQueue.then(() => new Promise(resolve => {
      setTimeout(() => {
        if (!outputEl) { resolve(); return; }
        const span = document.createElement('span');
        span.className = `t-line${cls ? ' ' + cls : ''}`;
        span.innerHTML = text;
        outputEl.appendChild(span);
        outputEl.appendChild(document.createTextNode('\n'));
        scrollBottom();
        resolve();
      }, delay);
    }));
    return printQueue;
  }

  function printBlank(delay = 0) { return printLine('', '', delay); }

  function printDivider(delay = 0) {
    return printLine('─'.repeat(60), 't-divider', delay);
  }

  function scrollBottom() {
    if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
  }

  function clear() {
    if (outputEl) outputEl.innerHTML = '';
    printQueue = Promise.resolve();
  }

  // Simulate a progress bar
  async function printProgress(label, durationMs = 1200, steps = 20) {
    return new Promise(resolve => {
      const barRow = document.createElement('div');
      barRow.className = 't-progress-bar';
      barRow.innerHTML = `
        <span class="t-muted" style="min-width:220px;font-size:11px;">${label}</span>
        <div class="progress-track"><div class="progress-fill" style="width:0%"></div></div>
        <span class="progress-pct">0%</span>`;
      if (!outputEl) { resolve(); return; }
      outputEl.appendChild(barRow);
      scrollBottom();

      let step = 0;
      const interval = setInterval(() => {
        step++;
        const pct = Math.min(100, Math.round((step / steps) * 100));
        barRow.querySelector('.progress-fill').style.width = pct + '%';
        barRow.querySelector('.progress-pct').textContent = pct + '%';
        if (step >= steps) {
          clearInterval(interval);
          resolve();
        }
      }, durationMs / steps);
    });
  }

  // Simulate an operation with status steps and random timing
  async function simulateOperation(steps) {
    for (const step of steps) {
      const delay = step.delay ?? (300 + Math.random() * step.variance ?? 400);
      await printLine(`  ${step.icon ?? '·'} ${step.text}`, step.cls ?? 't-muted', delay);
    }
  }

  // ── Boot sequence ──────────────────────────────────────────────────────

  async function runBoot() {
    locked = true;
    clear();

    const lines = [
      { text: 'STRATA OS v4.2.1 — FOUNDATION HARDENED COMPUTING ENVIRONMENT', cls: 't-header', delay: 0 },
      { text: '─'.repeat(60), cls: 't-divider', delay: 60 },
      { text: 'Copyright © The Foundation. All rights reserved.', cls: 't-muted', delay: 40 },
      { text: 'Unauthorised access constitutes a Class-IV breach.', cls: 't-muted', delay: 30 },
      { text: '', delay: 40 },
      { text: 'BEDROCK LAYER VERIFICATION', cls: 't-system', delay: 80 },
    ];
    for (const l of lines) await printLine(l.text, l.cls, l.delay);

    await printProgress('Verifying hardware integrity hash…', 900, 18);
    await printLine('  ✓ Bedrock signature VALID', 't-success', 80);
    await printLine('  ✓ Boot partition write-protection CONFIRMED', 't-success', 60);
    await printBlank(40);

    await printLine('KERNEL INITIALISATION — STRATA-5', 't-system', 60);
    await printProgress('Loading kernel modules…', 700, 14);
    await printLine('  ✓ Process scheduler ONLINE', 't-success', 60);
    await printLine('  ✓ Memory subsystem INITIALISED', 't-success', 50);
    await printLine('  ✓ Hardware abstraction layer READY', 't-success', 50);
    await printBlank(40);

    await printLine('SYSTEM CONTROL LAYER — STRATA-4', 't-system', 60);
    await printProgress('Applying security policy…', 600, 12);
    await printLine('  ✓ Access control matrix LOADED', 't-success', 50);
    await printLine('  ✓ Audit logging daemon ACTIVE', 't-success', 50);
    await printBlank(40);

    await printLine('PROXY INTERFACE LAYER — STRATA-3', 't-system', 60);
    await printProgress('Establishing isolated proxy channels…', 800, 16);
    await printLine('  ✓ External database proxies SANDBOXED', 't-success', 50);
    await printLine('  ✓ Read-only enforcement ACTIVE', 't-success', 50);
    await printLine('  ✓ Write-authorisation gate STANDBY', 't-success', 50);
    await printBlank(40);

    await printLine('PROCESSING & VALIDATION LAYER — STRATA-2', 't-system', 60);
    await printProgress('Loading sanitisation filters…', 600, 12);
    await printLine('  ✓ Input validation engine READY', 't-success', 50);
    await printLine('  ✓ Cognitohazard filter v3.1 LOADED', 't-success', 50);
    await printBlank(40);

    await printLine('APPLICATION LAYER — STRATA-1', 't-system', 60);
    await printProgress('Mounting application environment…', 700, 14);
    await printLine('  ✓ Session environment CLEAN (ephemeral)', 't-success', 50);
    await printLine('  ✓ Application manifests VERIFIED', 't-success', 50);
    await printBlank(40);

    await printLine('INTERFACE LAYER — STRATA-0', 't-system', 60);
    await printProgress('Initialising terminal interface…', 500, 10);
    await printLine('  ✓ Display subsystem READY', 't-success', 50);
    await printBlank(50);

    await printDivider(60);
    await printLine('ALL LAYERS NOMINAL — SYSTEM READY', 't-success', 80);
    await printDivider(40);
    await printBlank(60);

    // Prompt for card
    await printLine('AUTHENTICATION REQUIRED', 't-header', 80);
    await printLine('This terminal requires valid Foundation credentials.', 't-muted', 40);
    await printBlank(30);

    printQueue.then(() => {
      locked = false;
      triggerCardLogin();
    });
  }

  function triggerCardLogin() {
    const users = StrataOS.getUsers();
    printLine('Awaiting keycard presentation…', 't-system', 200).then(() => {
      Auth.showCardModal(users, user => onLoginComplete(user));
    });
  }

  async function onLoginComplete(user) {
    locked = true;
    clear();

    const cl = Auth.CL_LABELS[user.clearance] || 'UNKNOWN';
    const site = user.tetheredSite
      ? `${user.tetheredSite.name} — ${user.tetheredSite.description}`
      : 'LOCATION UNRESOLVED — SITE ASSIGNMENT PENDING';

    await printLine('AUTHENTICATION SUCCESSFUL', 't-success', 0);
    await printDivider(40);
    await printBlank(30);

    await simulateOperation([
      { text: 'Validating clearance token…', cls: 't-muted', delay: 300, variance: 200 },
      { text: 'Checking scope authorisations…', cls: 't-muted', delay: 250, variance: 150 },
      { text: 'Establishing session sandbox…', cls: 't-muted', delay: 200, variance: 200 },
      { text: 'Binding ephemeral session key…', cls: 't-muted', delay: 280, variance: 150 },
      { text: 'Resolving tethered site via geolocation…', cls: 't-muted', delay: 350, variance: 300 },
      { text: 'Applying user permissions matrix…', cls: 't-muted', delay: 220, variance: 100 },
    ]);
    await printBlank(40);

    await printLine('SESSION ESTABLISHED', 't-success', 80);
    await printDivider(40);
    await printBlank(30);

    await printLine(`  WELCOME, ${user.title.toUpperCase()} ${user.name.toUpperCase()}`, 't-header', 60);
    await printBlank(20);
    await printLine(`  UID             : ${user.uid}`, 't-value', 40);
    await printLine(`  ROLE            : ${user.role}`, 't-value', 30);
    await printLine(`  CLEARANCE       : ${user.clearance} — ${cl}`, 't-value', 30);
    await printLine(`  SCOPES          : ${user.scopes.join(', ')}`, 't-value', 30);
    await printLine(`  TETHERED SITE   : ${site}`, 't-value', 30);
    await printLine(`  SESSION TYPE    : EPHEMERAL (data will not persist)`, 't-value', 30);
    await printLine(`  TERMINAL        : STRATA-0 / ${navigator.platform || 'UNKNOWN PLATFORM'}`, 't-value', 30);
    await printBlank(40);
    await printDivider(40);
    await printBlank(30);

    await printLine('Type <span class="t-system">help</span> for available commands.', '', 40);
    await printLine('Type <span class="t-system">startx</span> to launch the graphical desktop environment.', '', 30);
    await printBlank(30);

    printQueue.then(() => {
      locked = false;
      updatePrompt();
    });
  }

  function updatePrompt() {
    if (!promptEl) return;
    const user = Auth.getUser();
    if (user) {
      promptEl.textContent = `STRATA@${user.uid} ~$ `;
    } else {
      promptEl.textContent = 'STRATA ~$ ';
    }
  }

  // ── Input handling ──────────────────────────────────────────────────────

  function init(outputId, inputId, promptId, desktopMode = false) {
    outputEl = document.getElementById(outputId);
    inputEl  = document.getElementById(inputId);
    promptEl = document.getElementById(promptId);
    isDesktopTerminal = desktopMode;

    if (inputEl) {
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') { handleInput(); }
        else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (historyIndex < history.length - 1) {
            historyIndex++;
            inputEl.value = history[history.length - 1 - historyIndex] || '';
          }
        }
        else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex > 0) {
            historyIndex--;
            inputEl.value = history[history.length - 1 - historyIndex] || '';
          } else { historyIndex = -1; inputEl.value = ''; }
        }
        else if (e.key === 'Tab') {
          e.preventDefault();
          autocomplete();
        }
      });
      // Click anywhere on terminal to focus input
      if (outputEl) {
        outputEl.addEventListener('click', () => inputEl.focus());
      }
    }
  }

  function handleInput() {
    if (locked || !inputEl) return;
    const raw = inputEl.value.trim();
    inputEl.value = '';
    historyIndex = -1;
    if (!raw) return;

    history.push(raw);
    if (history.length > 100) history.shift();

    const user = Auth.getUser();
    const promptText = user ? `STRATA@${user.uid} ~$ ` : 'STRATA ~$ ';
    printLine(`<span class="t-muted">${promptText}</span><span class="t-input">${escHtml(raw)}</span>`);

    parseCommand(raw);
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function autocomplete() {
    if (!inputEl) return;
    const partial = inputEl.value.trim().toLowerCase();
    const match = ALL_COMMANDS.find(c => c.startsWith(partial) && c !== partial);
    if (match) inputEl.value = match;
  }

  // ── Command parser ──────────────────────────────────────────────────────

  const ALL_COMMANDS = [
    'help','clear','whoami','status','version','uptime','date','echo','logout',
    'startx','theme','sysinfo','net','ping','traceroute','ifconfig',
    'ps','kill','top','mem','disk','log','audit','scan','lock',
    'ls','cd','pwd','cat','mkdir','rm','touch','cp','mv','find',
    'access','auth','clearance','scope','session','permissions',
    'connect','disconnect','proxy','vpn','firewall',
    'db','query','archive','write','export',
    'alert','broadcast','msg','notify',
    'reboot','shutdown','panic','lockdown',
    'calc','encrypt','decrypt','hash','checksum',
    'env','set','unset','alias','history',
    'man','info','debug','verbose',
    'telemetry','diagnostics','benchmark','stress'
  ];

  function parseCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd  = parts[0].toLowerCase();
    const args = parts.slice(1);
    const user = Auth.getUser();

    switch (cmd) {

      // ── General ──
      case 'help':      return cmdHelp(args);
      case 'clear':     return clear();
      case 'whoami':    return cmdWhoami();
      case 'status':    return cmdStatus();
      case 'version':   return cmdVersion();
      case 'uptime':    return cmdUptime();
      case 'date':      return cmdDate();
      case 'echo':      return printLine(args.join(' '), 't-value');
      case 'logout':    return cmdLogout();
      case 'startx':    return cmdStartX();
      case 'theme':     return cmdTheme(args);
      case 'history':   return cmdHistory();
      case 'env':       return cmdEnv();
      case 'man':       return cmdMan(args);
      case 'info':      return cmdInfo(args);

      // ── System ──
      case 'sysinfo':     return cmdSysinfo();
      case 'ps':          return cmdPs();
      case 'top':         return cmdTop();
      case 'mem':         return cmdMem();
      case 'disk':        return cmdDisk();
      case 'log':         return cmdLog(args);
      case 'audit':       return cmdAudit(args);
      case 'diagnostics': return cmdDiagnostics();
      case 'benchmark':   return cmdBenchmark();
      case 'telemetry':   return cmdTelemetry();
      case 'debug':       return cmdDebug(args);
      case 'reboot':      return cmdReboot();
      case 'shutdown':    return cmdShutdown();
      case 'panic':       return cmdPanic();
      case 'lockdown':    return cmdLockdown(args);

      // ── Filesystem ──
      case 'ls':    return cmdLs(args);
      case 'cd':    return cmdCd(args);
      case 'pwd':   return cmdPwd();
      case 'cat':   return cmdCat(args);
      case 'mkdir': return cmdMkdir(args);
      case 'rm':    return cmdRm(args);
      case 'touch': return cmdTouch(args);
      case 'cp':    return cmdCp(args);
      case 'mv':    return cmdMv(args);
      case 'find':  return cmdFind(args);

      // ── Network ──
      case 'net':        return cmdNet(args);
      case 'ping':       return cmdPing(args);
      case 'traceroute': return cmdTraceroute(args);
      case 'ifconfig':   return cmdIfconfig();
      case 'connect':    return cmdConnect(args);
      case 'disconnect': return cmdDisconnect(args);
      case 'proxy':      return cmdProxy(args);
      case 'vpn':        return cmdVpn(args);
      case 'firewall':   return cmdFirewall(args);

      // ── Access & Auth ──
      case 'access':      return cmdAccess(args);
      case 'auth':        return cmdAuth(args);
      case 'clearance':   return cmdClearance();
      case 'scope':       return cmdScope();
      case 'session':     return cmdSession();
      case 'permissions': return cmdPermissions();
      case 'scan':        return cmdScan(args);
      case 'lock':        return cmdLock();

      // ── Database ──
      case 'db':      return cmdDb(args);
      case 'query':   return cmdQuery(args);
      case 'archive': return cmdArchiveCmd(args);
      case 'write':   return cmdWrite(args);
      case 'export':  return cmdExport(args);

      // ── Comms ──
      case 'alert':     return cmdAlert(args);
      case 'broadcast': return cmdBroadcast(args);
      case 'msg':       return cmdMsg(args);
      case 'notify':    return cmdNotify(args);

      // ── Crypto ──
      case 'encrypt':  return cmdEncrypt(args);
      case 'decrypt':  return cmdDecrypt(args);
      case 'hash':     return cmdHash(args);
      case 'checksum': return cmdChecksum(args);

      // ── Misc ──
      case 'kill':    return cmdKill(args);
      case 'stress':  return cmdStress();
      case 'verbose': return printLine('[ verbose mode not available in STRATA-0 ]', 't-warn');
      case 'set':     return printLine('[ use env to view variables; set is restricted ]', 't-warn');

      default:
        printLine(`[ command not found: ${escHtml(cmd)} — type 'help' ]`, 't-error');
    }
  }

  // ── Require auth helper ──────────────────────────────────────────────────
  function requireAuth(fn) {
    if (!Auth.getUser()) {
      printLine('[ authentication required ]', 't-error');
      return;
    }
    fn();
  }

  function requireClearance(level, fn) {
    if (!Auth.hasClearance(level)) {
      printLine(`[ ACCESS DENIED — clearance level ${level} required ]`, 't-error');
      printLine('  Incident has been logged.', 't-warn');
      return;
    }
    fn();
  }

  function requireScope(scope, fn) {
    if (!Auth.hasScope(scope)) {
      printLine(`[ ACCESS DENIED — scope '${scope}' not in your authorisation ]`, 't-error');
      return;
    }
    fn();
  }

  // ── Command implementations ──────────────────────────────────────────────

  function cmdHelp(args) {
    if (args[0]) {
      // man fallback
      return cmdMan(args);
    }
    printLine('STRATA OS — COMMAND REFERENCE', 't-header');
    printDivider();
    const sections = [
      { title: 'GENERAL', cmds: [
        ['help [cmd]',   'Show this help or command details'],
        ['clear',        'Clear terminal output'],
        ['whoami',       'Display current session identity'],
        ['status',       'System and session status summary'],
        ['version',      'STRATA version information'],
        ['uptime',       'System uptime'],
        ['date',         'Current date and time'],
        ['echo [text]',  'Print text'],
        ['history',      'Command history'],
        ['env',          'Show environment variables'],
        ['logout',       'Terminate session'],
        ['startx',       'Launch desktop environment'],
        ['theme [dark|light]', 'Toggle display theme'],
      ]},
      { title: 'SYSTEM', cmds: [
        ['sysinfo',     'Hardware and OS information'],
        ['ps',          'Running processes'],
        ['top',         'Process resource usage'],
        ['mem',         'Memory usage report'],
        ['disk',        'Disk usage report'],
        ['log [n]',     'View system log (last n entries)'],
        ['audit [uid]', 'View audit trail'],
        ['diagnostics', 'Run system diagnostics'],
        ['benchmark',   'Run performance benchmark'],
        ['telemetry',   'View system telemetry'],
        ['reboot',      'Reboot terminal session'],
        ['shutdown',    'Initiate system shutdown'],
        ['panic',       'Emergency halt (requires clearance)'],
        ['lockdown [code]', 'Initiate site lockdown (requires clearance 4+)'],
      ]},
      { title: 'FILESYSTEM', cmds: [
        ['ls [path]',      'List directory contents'],
        ['cd [path]',      'Change directory'],
        ['pwd',            'Print working directory'],
        ['cat [file]',     'View file contents'],
        ['mkdir [name]',   'Create directory'],
        ['rm [file]',      'Delete file'],
        ['touch [name]',   'Create empty file'],
        ['cp [src] [dst]', 'Copy file'],
        ['mv [src] [dst]', 'Move/rename file'],
        ['find [term]',    'Search filesystem'],
      ]},
      { title: 'NETWORK', cmds: [
        ['net [status|routes|stats]', 'Network information'],
        ['ping [host]',              'Ping a host'],
        ['traceroute [host]',        'Trace network route'],
        ['ifconfig',                 'Interface configuration'],
        ['connect [endpoint]',       'Connect to remote endpoint'],
        ['disconnect',               'Disconnect active session'],
        ['proxy [status|list]',      'Proxy interface status'],
        ['vpn [status|connect|disconnect]', 'VPN management'],
        ['firewall [rules|status]',  'Firewall configuration'],
      ]},
      { title: 'ACCESS & SECURITY', cmds: [
        ['access [check] [scope]', 'Check access permissions'],
        ['auth [status|refresh]',  'Authentication status'],
        ['clearance',              'View clearance level'],
        ['scope',                  'List active scopes'],
        ['session',                'Session details'],
        ['permissions',            'Full permissions summary'],
        ['scan [target]',          'Security scan'],
        ['lock',                   'Lock terminal'],
      ]},
      { title: 'DATABASE', cmds: [
        ['db [status|list]',      'Database connection status'],
        ['query [db] [term]',     'Query read-only database'],
        ['archive [list|open]',   'Archive database access'],
        ['write [db] [data]',     'Write to authorised database (scope required)'],
        ['export [db] [format]',  'Export query results'],
      ]},
      { title: 'COMMUNICATIONS', cmds: [
        ['alert [level] [msg]',   'Send alert (security scope)'],
        ['broadcast [msg]',       'Site-wide broadcast (authority required)'],
        ['msg [uid] [text]',      'Message a specific user'],
        ['notify [uid] [text]',   'Send system notification'],
      ]},
      { title: 'CRYPTOGRAPHIC', cmds: [
        ['encrypt [text]',    'Encrypt string (simulated)'],
        ['decrypt [hash]',    'Decrypt (clearance 3+ required)'],
        ['hash [text]',       'SHA-style hash of input'],
        ['checksum [file]',   'File checksum verification'],
      ]},
    ];
    for (const sec of sections) {
      printBlank();
      printLine(`  ${sec.title}`, 't-system');
      for (const [cmd, desc] of sec.cmds) {
        printLine(`    <span class="t-accent" style="color:var(--accent);min-width:220px;display:inline-block;">${cmd.padEnd(30)}</span><span class="t-muted">${desc}</span>`);
      }
    }
    printBlank();
    printDivider();
    printLine('  Commands marked with ACCESS DENIED require elevated clearance or scope.', 't-muted');
  }

  function cmdWhoami() {
    requireAuth(() => {
      const u = Auth.getUser();
      printLine(`${u.title} ${u.name}`, 't-value');
      printLine(`UID: ${u.uid}  |  ROLE: ${u.role}  |  CLEARANCE: ${u.clearance}`, 't-muted');
    });
  }

  function cmdStatus() {
    requireAuth(() => {
      const u = Auth.getUser();
      const site = u.tetheredSite ? u.tetheredSite.name : 'UNRESOLVED';
      printLine('SYSTEM STATUS', 't-header');
      printDivider();
      printLine(`  Session     : ACTIVE (ephemeral)`, 't-value');
      printLine(`  User        : ${u.uid} — ${u.name}`, 't-value');
      printLine(`  Clearance   : ${u.clearance}`, 't-value');
      printLine(`  Site        : ${site}`, 't-value');
      printLine(`  Theme       : ${theme.toUpperCase()}`, 't-value');
      printLine(`  Layers      : ALL NOMINAL`, 't-success');
      printLine(`  Proxies     : SANDBOXED / READ-ONLY`, 't-success');
      printLine(`  Audit log   : ACTIVE`, 't-success');
    });
  }

  function cmdVersion() {
    printLine('STRATA OS v4.2.1 (build 20240901-HARDENED)', 't-system');
    printLine('Foundation Hardened Computing Environment', 't-muted');
    printLine('Kernel: STRATA-K 2.7.4  |  Bedrock: 1.0.0-IMMUTABLE', 't-muted');
  }

  function cmdUptime() {
    const ms = performance.now();
    const s = Math.floor(ms/1000);
    const m = Math.floor(s/60);
    const h = Math.floor(m/60);
    printLine(`Terminal uptime: ${h}h ${m%60}m ${s%60}s`, 't-value');
    printLine('System uptime (simulated): 47d 12h 08m', 't-muted');
  }

  function cmdDate() {
    const now = new Date();
    printLine(now.toUTCString() + ' (UTC)', 't-value');
    printLine(now.toLocaleString(), 't-muted');
  }

  function cmdLogout() {
    requireAuth(() => {
      printLine('Terminating session…', 't-warn');
      printLine('Wiping ephemeral session data…', 't-muted');
      printLine('Session ended. Goodbye.', 't-success');
      printQueue.then(() => setTimeout(() => Auth.logout(), 1200));
    });
  }

  function cmdStartX() {
    requireAuth(() => {
      if (isDesktopTerminal) {
        printLine('[ already in graphical environment ]', 't-warn');
        return;
      }
      printLine('Launching graphical desktop environment…', 't-system');
      simulateOperation([
        { text: 'Compositing display server…', delay: 300, variance: 200 },
        { text: 'Loading window manager…', delay: 250, variance: 150 },
        { text: 'Mounting application manifests…', delay: 280, variance: 200 },
        { text: 'Applying user environment…', delay: 200, variance: 100 },
      ]).then(() => {
        printLine('Desktop environment READY', 't-success');
        printQueue.then(() => setTimeout(() => Desktop.launch(), 800));
      });
    });
  }

  function cmdTheme(args) {
    const t = args[0]?.toLowerCase();
    if (t === 'dark') {
      document.body.classList.add('dark-mode');
      theme = 'dark';
      printLine('Theme set to DARK.', 't-success');
    } else if (t === 'light') {
      document.body.classList.remove('dark-mode');
      theme = 'light';
      printLine('Theme set to LIGHT.', 't-success');
    } else {
      // Toggle
      if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode');
        theme = 'light';
        printLine('Theme set to LIGHT.', 't-success');
      } else {
        document.body.classList.add('dark-mode');
        theme = 'dark';
        printLine('Theme set to DARK.', 't-success');
      }
    }
    StrataOS.setTheme(theme);
  }

  function cmdHistory() {
    if (history.length === 0) { printLine('[ no history ]', 't-muted'); return; }
    history.forEach((h, i) => printLine(`  ${String(i+1).padStart(4,'0')}  ${h}`, 't-muted'));
  }

  function cmdEnv() {
    const user = Auth.getUser();
    printLine('ENVIRONMENT', 't-header');
    printLine(`  STRATA_VERSION=4.2.1`, 't-muted');
    printLine(`  STRATA_THEME=${theme}`, 't-muted');
    printLine(`  SESSION_TYPE=EPHEMERAL`, 't-muted');
    if (user) {
      printLine(`  USER_UID=${user.uid}`, 't-muted');
      printLine(`  USER_CLEARANCE=${user.clearance}`, 't-muted');
    }
    printLine(`  PLATFORM=${navigator.platform || 'UNKNOWN'}`, 't-muted');
    printLine(`  LOCALE=${navigator.language || 'UNKNOWN'}`, 't-muted');
  }

  function cmdMan(args) {
    const topic = args[0]?.toLowerCase();
    if (!topic) { printLine('Usage: man [command]', 't-muted'); return; }
    const docs = {
      startx: 'startx — launches the STRATA graphical desktop environment. Requires active session.',
      logout: 'logout — terminates the current session and wipes all ephemeral data.',
      theme: 'theme [dark|light] — switches display theme. Can also be toggled without argument.',
      db: 'db [status|list] — shows database proxy connection status and available read-only databases.',
      query: 'query [database] [term] — perform a read-only query against an authorised database proxy.',
      write: 'write [database] [data] — write to a database. Requires ARCHIVE or NETTECH scope.',
      lockdown: 'lockdown [code] — initiates site lockdown protocol. Requires clearance 4 and SECURITY scope.',
      panic: 'panic — triggers AEGIS emergency halt. Requires clearance 5.',
      scan: 'scan [target] — runs a security scan. SECURITY scope required for full results.',
    };
    if (docs[topic]) {
      printLine(`MAN — ${topic.toUpperCase()}`, 't-header');
      printDivider();
      printLine(`  ${docs[topic]}`, 't-muted');
    } else {
      printLine(`[ no manual entry for '${topic}' ]`, 't-warn');
    }
  }

  function cmdInfo(args) {
    cmdMan(args);
  }

  // ── System commands ──

  function cmdSysinfo() {
    printLine('SYSTEM INFORMATION', 't-header');
    printDivider();
    printLine(`  OS            : STRATA OS v4.2.1`, 't-value');
    printLine(`  Build         : HARDENED / CLASSIFIED`, 't-value');
    printLine(`  Architecture  : STRATIFIED (7 layers)`, 't-value');
    printLine(`  Kernel        : STRATA-K 2.7.4`, 't-value');
    printLine(`  Platform      : ${navigator.platform || 'UNDETECTED'}`, 't-value');
    printLine(`  User-Agent    : ${navigator.userAgent.substring(0,60)}…`, 't-muted');
    printLine(`  Locale        : ${navigator.language}`, 't-value');
    printLine(`  Online        : ${navigator.onLine ? 'YES' : 'NO'}`, 't-value');
    printLine(`  Cores         : ${navigator.hardwareConcurrency || '?'}`, 't-value');
    printLine(`  Memory        : ${(navigator as any).deviceMemory ? (navigator as any).deviceMemory + ' GB' : 'CLASSIFIED'}`, 't-value');
  }

  function cmdPs() {
    printLine('PROCESS LIST', 't-header');
    printDivider();
    const procs = [
      ['0001', 'bedrock-watchdog',   '0.0', '12.4'],
      ['0002', 'strata-kernel',      '0.1', '48.2'],
      ['0003', 'sysctl',             '0.0', '8.1'],
      ['0004', 'audit-daemon',       '0.2', '14.6'],
      ['0005', 'proxy-sandbox',      '0.3', '22.8'],
      ['0006', 'cogfilt-v3',         '0.1', '18.3'],
      ['0007', 'session-manager',    '0.4', '31.2'],
      ['0008', 'strata-terminal',    '1.2', '44.1'],
      ['0009', 'net-monitor',        '0.1', '9.8'],
    ];
    printLine('  PID   NAME                   CPU%   MEM(MB)', 't-muted');
    for (const [pid, name, cpu, mem] of procs) {
      printLine(`  ${pid}   ${name.padEnd(22)} ${cpu.padStart(5)}   ${mem.padStart(8)}`, 't-value');
    }
  }

  function cmdTop() {
    printLine('PROCESS MONITOR (snapshot)', 't-header');
    printDivider();
    printLine('  CPU usage      : 3.4%', 't-value');
    printLine('  Memory         : 312 MB / 2048 MB (15.2%)', 't-value');
    printLine('  Processes      : 9 running, 0 stopped', 't-value');
    printLine('  Load average   : 0.12, 0.08, 0.05', 't-value');
  }

  function cmdMem() {
    printLine('MEMORY REPORT', 't-header');
    printDivider();
    printLine('  Total          : 2048 MB', 't-value');
    printLine('  Used           : 312 MB', 't-value');
    printLine('  Available      : 1736 MB', 't-value');
    printLine('  Ephemeral heap : 44 MB (session)', 't-value');
    printLine('  Kernel reserve : 128 MB (locked)', 't-value');
  }

  function cmdDisk() {
    printLine('DISK USAGE', 't-header');
    printDivider();
    printLine('  /bedrock       :  128 MB  (READ-ONLY, write-protected)', 't-value');
    printLine('  /system        :  2.1 GB  (READ-ONLY)', 't-value');
    printLine('  /session       :  44 MB   (EPHEMERAL)', 't-value');
    printLine('  /archive-proxy :  REMOTE  (read-only via proxy)', 't-value');
    printLine('  Total session  :  44 MB', 't-muted');
  }

  const LOG_ENTRIES = [
    'Kernel initialised — all layers nominal',
    'Audit daemon started — log rotation ACTIVE',
    'Proxy sandbox established — 3 channels OPEN',
    'Cognitohazard filter v3.1 LOADED',
    'Session manager READY',
    'Terminal STRATA-0 ONLINE',
    'Authentication request received',
    'Keycard verified — authentication SUCCESSFUL',
    'Session established — ephemeral mode',
    'User environment applied',
  ];

  function cmdLog(args) {
    const n = parseInt(args[0]) || LOG_ENTRIES.length;
    printLine('SYSTEM LOG', 't-header');
    printDivider();
    LOG_ENTRIES.slice(-n).forEach((e, i) => {
      printLine(`  [${String(i).padStart(4,'0')}]  ${e}`, 't-muted');
    });
  }

  function cmdAudit(args) {
    requireAuth(() => {
      requireScope('SECURITY', () => {
        const target = args[0] || Auth.getUser().uid;
        printLine(`AUDIT TRAIL — ${target}`, 't-header');
        printDivider();
        printLine(`  AUTH  LOGIN     Keycard presented — verified`, 't-value');
        printLine(`  AUTH  PASS      Password sequence completed`, 't-value');
        printLine(`  SESS  CREATE    Ephemeral session established`, 't-value');
        printLine(`  CMD   TERMINAL  Various terminal commands`, 't-muted');
        printLine(`  (Full audit available to clearance 4+)`, 't-muted');
      });
    });
  }

  function cmdDiagnostics() {
    printLine('RUNNING DIAGNOSTICS…', 't-system');
    simulateOperation([
      { text: 'Checking Bedrock layer integrity…', delay: 400, variance: 200 },
      { text: 'Testing kernel process isolation…', delay: 350, variance: 150 },
      { text: 'Verifying proxy sandbox boundaries…', delay: 380, variance: 200 },
      { text: 'Validating cognitohazard filter…', delay: 300, variance: 100 },
      { text: 'Checking audit daemon health…', delay: 280, variance: 150 },
      { text: 'Testing session entropy…', delay: 250, variance: 100 },
    ]).then(() => {
      printBlank();
      printLine('DIAGNOSTICS COMPLETE — ALL SYSTEMS NOMINAL', 't-success');
    });
  }

  function cmdBenchmark() {
    printLine('RUNNING PERFORMANCE BENCHMARK…', 't-system');
    printLine('(simulated — actual hardware metrics not available at STRATA-0)', 't-muted');
    printProgress('Integer arithmetic…', 800, 16).then(() =>
      printLine('  Score: 14,822 ops/ms', 't-value')).then(() =>
    printProgress('Memory bandwidth…', 700, 14).then(() =>
      printLine('  Score: 8,441 MB/s', 't-value'))).then(() =>
    printProgress('I/O throughput…', 600, 12).then(() =>
      printLine('  Score: 312 MB/s (proxy-limited)', 't-value'))).then(() => {
        printBlank();
        printLine('Benchmark complete.', 't-success');
      });
  }

  function cmdTelemetry() {
    requireAuth(() => {
      printLine('TELEMETRY SNAPSHOT', 't-header');
      printDivider();
      printLine(`  Proxy requests (session) : ${Math.floor(Math.random()*20)+2}`, 't-value');
      printLine(`  Commands issued          : ${history.length}`, 't-value');
      printLine(`  Auth events              : 1 login`, 't-value');
      printLine(`  Failed auth attempts     : ${(Auth as any)._attempts?.length ?? 0}`, 't-value');
      printLine(`  Memory delta (session)   : +${Math.floor(Math.random()*12)+2} MB`, 't-value');
      printLine(`  Network I/O              : ${Math.floor(Math.random()*400)+100} KB`, 't-value');
    });
  }

  function cmdDebug(args) {
    requireClearance(3, () => {
      printLine('DEBUG OUTPUT (Strata-0 surface only)', 't-warn');
      printDivider();
      printLine('  Session storage keys: ' + Object.keys(sessionStorage).join(', '), 't-muted');
      printLine('  Theme: ' + theme, 't-muted');
      printLine('  History length: ' + history.length, 't-muted');
    });
  }

  function cmdReboot() {
    requireAuth(() => {
      printLine('Initiating terminal reboot sequence…', 't-warn');
      simulateOperation([
        { text: 'Flushing ephemeral session data…', delay: 300 },
        { text: 'Terminating application processes…', delay: 250 },
        { text: 'Clearing memory…', delay: 200 },
      ]).then(() => {
        printLine('Reboot complete — reinitialising…', 't-success');
        printQueue.then(() => setTimeout(() => location.reload(), 1200));
      });
    });
  }

  function cmdShutdown() {
    requireClearance(3, () => {
      printLine('SHUTDOWN INITIATED', 't-warn');
      printLine('Session will terminate in 5 seconds.', 't-muted');
      printQueue.then(() => setTimeout(() => Auth.logout(), 5000));
    });
  }

  function cmdPanic() {
    requireClearance(5, () => {
      printLine('⚠ AEGIS EMERGENCY HALT INITIATED ⚠', 't-error');
      printLine('All processes terminating.', 't-error');
      printLine('Memory wipe in progress.', 't-error');
      printQueue.then(() => setTimeout(() => {
        sessionStorage.clear();
        document.body.innerHTML = `
          <div style="background:#000;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;">
            <div style="color:#c40233;font-family:monospace;font-size:28px;letter-spacing:0.3em;">AEGIS PROTOCOL ACTIVE</div>
            <div style="color:#555;font-family:monospace;font-size:12px;">System halted. Contact site authority to restore.</div>
          </div>`;
      }, 1500));
    });
  }

  function cmdLockdown(args) {
    requireClearance(4, () => {
      requireScope('SECURITY', () => {
        const code = args[0] || 'UNSPECIFIED';
        printLine(`SITE LOCKDOWN INITIATED — CODE: ${code}`, 't-error');
        printLine('Broadcasting to all connected terminals…', 't-warn');
        simulateOperation([
          { text: 'Notifying site security…', delay: 400, variance: 200 },
          { text: 'Locking containment access points…', delay: 350, variance: 150 },
          { text: 'Initiating headcount protocol…', delay: 300, variance: 100 },
          { text: 'Broadcasting alert on all channels…', delay: 280, variance: 100 },
        ]).then(() => {
          printLine('LOCKDOWN ACTIVE — AWAIT FURTHER INSTRUCTION', 't-error');
          StrataOS.showToast('LOCKDOWN INITIATED — SEE TERMINAL', 'error');
        });
      });
    });
  }

  // ── Filesystem (simulated, using sessionStorage) ──

  const FS = {
    get cwd() { return sessionStorage.getItem('fs_cwd') || '/home'; },
    set cwd(v) { sessionStorage.setItem('fs_cwd', v); },
    dirs: () => {
      const stored = sessionStorage.getItem('fs_dirs');
      const base = ['/home','/home/desktop','/home/documents','/home/downloads','/home/media'];
      return stored ? JSON.parse(stored) : base;
    },
    files: () => {
      const stored = sessionStorage.getItem('fs_files');
      return stored ? JSON.parse(stored) : {};
    },
    saveDirs(d) { sessionStorage.setItem('fs_dirs', JSON.stringify(d)); },
    saveFiles(f) { sessionStorage.setItem('fs_files', JSON.stringify(f)); },
    resolve(p) {
      if (p.startsWith('/')) return p;
      return (this.cwd + '/' + p).replace(/\/+/g,'/');
    },
    listDir(p) {
      const dirs = this.dirs().filter(d => {
        const parent = d.replace(/\/[^/]+$/,'') || '/';
        return parent === p && d !== p;
      });
      const files = Object.keys(this.files()).filter(f => {
        const parent = f.replace(/\/[^/]+$/,'') || '/';
        return parent === p;
      });
      return { dirs, files };
    }
  };

  // Restricted paths by scope
  function checkFsAccess(path) {
    const user = Auth.getUser();
    if (!user) return false;
    const restricted = ['/system','/bedrock','/kernel','/proxy','/archive-proxy'];
    const isRestricted = restricted.some(r => path.startsWith(r));
    if (isRestricted && !Auth.hasScope('NETTECH') && !Auth.hasClearance(4)) return false;
    return true;
  }

  function cmdLs(args) {
    requireAuth(() => {
      const target = FS.resolve(args[0] || FS.cwd);
      if (!checkFsAccess(target)) { printLine('[ ACCESS DENIED ]', 't-error'); return; }
      const { dirs, files } = FS.listDir(target);
      if (dirs.length === 0 && files.length === 0) {
        printLine('(empty)', 't-muted'); return;
      }
      printLine(`Contents of ${target}:`, 't-muted');
      dirs.forEach(d  => printLine(`  📁  ${d.split('/').pop()}/`, 't-system'));
      files.forEach(f => printLine(`  📄  ${f.split('/').pop()}`, 't-value'));
    });
  }

  function cmdCd(args) {
    requireAuth(() => {
      const target = FS.resolve(args[0] || '/home');
      if (!checkFsAccess(target)) { printLine('[ ACCESS DENIED ]', 't-error'); return; }
      const dirs = FS.dirs();
      if (!dirs.includes(target)) { printLine(`[ no such directory: ${target} ]`, 't-error'); return; }
      FS.cwd = target;
      updatePrompt();
    });
  }

  function cmdPwd() {
    requireAuth(() => printLine(FS.cwd, 't-value'));
  }

  function cmdCat(args) {
    requireAuth(() => {
      if (!args[0]) { printLine('Usage: cat [file]', 't-muted'); return; }
      const path = FS.resolve(args[0]);
      const files = FS.files();
      if (!files[path]) { printLine(`[ file not found: ${path} ]`, 't-error'); return; }
      printLine(files[path], 't-value');
    });
  }

  function cmdMkdir(args) {
    requireAuth(() => {
      if (!args[0]) { printLine('Usage: mkdir [name]', 't-muted'); return; }
      const path = FS.resolve(args[0]);
      const dirs = FS.dirs();
      if (dirs.includes(path)) { printLine('[ directory already exists ]', 't-warn'); return; }
      dirs.push(path);
      FS.saveDirs(dirs);
      printLine(`Created: ${path}`, 't-success');
    });
  }

  function cmdTouch(args) {
    requireAuth(() => {
      if (!args[0]) { printLine('Usage: touch [name]', 't-muted'); return; }
      const path = FS.resolve(args[0]);
      const files = FS.files();
      files[path] = files[path] || '';
      FS.saveFiles(files);
      printLine(`Created: ${path}`, 't-success');
    });
  }

  function cmdRm(args) {
    requireAuth(() => {
      if (!args[0]) { printLine('Usage: rm [file]', 't-muted'); return; }
      const path = FS.resolve(args[0]);
      const files = FS.files();
      if (!files[path]) { printLine(`[ not found: ${path} ]`, 't-error'); return; }
      delete files[path];
      FS.saveFiles(files);
      printLine(`Removed: ${path}`, 't-success');
    });
  }

  function cmdCp(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: cp [src] [dst]', 't-muted'); return; }
      const src = FS.resolve(args[0]), dst = FS.resolve(args[1]);
      const files = FS.files();
      if (!files[src]) { printLine(`[ source not found: ${src} ]`, 't-error'); return; }
      files[dst] = files[src];
      FS.saveFiles(files);
      printLine(`Copied ${src} → ${dst}`, 't-success');
    });
  }

  function cmdMv(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: mv [src] [dst]', 't-muted'); return; }
      const src = FS.resolve(args[0]), dst = FS.resolve(args[1]);
      const files = FS.files();
      if (!files[src]) { printLine(`[ source not found: ${src} ]`, 't-error'); return; }
      files[dst] = files[src];
      delete files[src];
      FS.saveFiles(files);
      printLine(`Moved ${src} → ${dst}`, 't-success');
    });
  }

  function cmdFind(args) {
    requireAuth(() => {
      const term = args[0];
      if (!term) { printLine('Usage: find [term]', 't-muted'); return; }
      const files = Object.keys(FS.files()).filter(f => f.includes(term));
      const dirs = FS.dirs().filter(d => d.includes(term));
      if (files.length + dirs.length === 0) { printLine('No results.', 't-muted'); return; }
      dirs.forEach(d => printLine(`  📁  ${d}`, 't-system'));
      files.forEach(f => printLine(`  📄  ${f}`, 't-value'));
    });
  }

  // ── Network commands ──

  function cmdNet(args) {
    const sub = args[0]?.toLowerCase() || 'status';
    if (sub === 'status') {
      printLine('NETWORK STATUS', 't-header');
      printLine('  Interface    : STRATA-ETH0 (virtual)', 't-value');
      printLine('  Address      : 10.0.██.██ / 24 (CLASSIFIED)', 't-value');
      printLine('  Gateway      : 10.0.██.1', 't-value');
      printLine('  DNS          : FOUNDATION-DNS-01', 't-value');
      printLine('  Proxy        : ACTIVE (Strata-3)', 't-value');
      printLine('  External     : READ-ONLY via sandboxed proxy', 't-value');
    } else if (sub === 'routes') {
      printLine('ROUTING TABLE', 't-header');
      printLine('  10.0.0.0/8      → INTERNAL (LAN)', 't-value');
      printLine('  172.16.0.0/12   → PROXY-CHAIN-01', 't-value');
      printLine('  0.0.0.0/0       → PROXY-SANDBOX-GATEWAY', 't-value');
    } else if (sub === 'stats') {
      printLine('NETWORK STATS (session)', 't-header');
      printLine(`  Bytes in  : ${(Math.random()*1024*200)|0} B`, 't-value');
      printLine(`  Bytes out : ${(Math.random()*1024*50)|0} B`, 't-value');
      printLine('  Errors    : 0', 't-value');
    }
  }

  function cmdPing(args) {
    const host = args[0] || '10.0.1.1';
    printLine(`PING ${host} — STRATA proxy route`, 't-system');
    const delays = [
      Math.floor(Math.random()*20)+8,
      Math.floor(Math.random()*20)+8,
      Math.floor(Math.random()*20)+8,
      Math.floor(Math.random()*20)+8,
    ];
    delays.forEach((d, i) => {
      printLine(`  64 bytes from ${host}: seq=${i+1} time=${d}ms`, 't-value', i * 500);
    });
    printQueue.then(() => {
      const avg = (delays.reduce((a,b)=>a+b,0)/delays.length).toFixed(1);
      printLine(`  — ${host}: 4 transmitted, 4 received, 0% loss, avg=${avg}ms`, 't-muted');
    });
  }

  function cmdTraceroute(args) {
    const host = args[0] || '10.0.1.1';
    printLine(`TRACEROUTE to ${host}`, 't-system');
    const hops = [
      { hop: 1, addr: '10.0.██.1',     ms: 1 },
      { hop: 2, addr: 'PROXY-SANDBOX', ms: 4 },
      { hop: 3, addr: 'STRATA-RELAY-01', ms: 9 },
      { hop: 4, addr: host,            ms: 14 },
    ];
    hops.forEach((h, i) => {
      printLine(`  ${h.hop}  ${h.addr.padEnd(20)}  ${h.ms}ms`, 't-value', i * 400 + 200);
    });
  }

  function cmdIfconfig() {
    printLine('INTERFACE CONFIGURATION', 't-header');
    printLine('  strata0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500', 't-value');
    printLine('    inet 10.0.██.██  netmask 255.255.255.0  broadcast 10.0.██.255', 't-muted');
    printLine('    TX packets 412  bytes 62144', 't-muted');
    printLine('    RX packets 389  bytes 55312', 't-muted');
  }

  function cmdConnect(args) {
    requireScope('NETTECH', () => {
      const ep = args[0] || 'unspecified';
      printLine(`Connecting to ${ep}…`, 't-system');
      simulateOperation([
        { text: 'Routing through proxy sandbox…', delay: 300, variance: 200 },
        { text: 'Authenticating endpoint…', delay: 400, variance: 200 },
        { text: 'Establishing secure channel…', delay: 350, variance: 150 },
      ]).then(() => printLine('Connection established (read-only).', 't-success'));
    });
  }

  function cmdDisconnect() {
    requireScope('NETTECH', () => {
      printLine('Disconnecting proxy channel…', 't-warn');
      setTimeout(() => printLine('Disconnected.', 't-success'), 600);
    });
  }

  function cmdProxy(args) {
    const sub = args[0]?.toLowerCase();
    if (sub === 'list') {
      printLine('ACTIVE PROXIES', 't-header');
      printLine('  PROXY-DB-01     — DATABASE (read-only)   ACTIVE', 't-value');
      printLine('  PROXY-ARCH-01   — ARCHIVE  (read-only)   ACTIVE', 't-value');
      printLine('  PROXY-NET-01    — EXTERNAL (sandboxed)   STANDBY', 't-value');
    } else {
      printLine('Proxy interface: ACTIVE / SANDBOXED', 't-system');
      printLine('All external communication is routed via Strata-3.', 't-muted');
      printLine('Read-only enforcement: ENABLED', 't-muted');
    }
  }

  function cmdVpn(args) {
    requireClearance(2, () => {
      const sub = args[0]?.toLowerCase();
      if (sub === 'connect') printLine('VPN: Tunnel ACTIVE (Foundation backbone)', 't-success');
      else if (sub === 'disconnect') printLine('VPN: Tunnel CLOSED', 't-warn');
      else printLine('VPN status: INACTIVE (use vpn connect)', 't-muted');
    });
  }

  function cmdFirewall(args) {
    requireClearance(3, () => {
      const sub = args[0]?.toLowerCase();
      if (sub === 'rules') {
        printLine('FIREWALL RULES', 't-header');
        printLine('  ALLOW   10.0.0.0/8    → INTERNAL', 't-success');
        printLine('  ALLOW   PROXY-SANDBOX → OUTBOUND', 't-success');
        printLine('  DENY    ALL           → DIRECT-EXTERNAL', 't-error');
        printLine('  LOG     ALL           → AUDIT', 't-muted');
      } else {
        printLine('Firewall: ACTIVE — 3 rules loaded', 't-success');
      }
    });
  }

  // ── Access & auth commands ──

  function cmdAccess(args) {
    requireAuth(() => {
      const scope = args[1] || args[0];
      if (!scope) {
        printLine('Usage: access check [scope]', 't-muted'); return;
      }
      const has = Auth.hasScope(scope.toUpperCase());
      printLine(`Scope '${scope.toUpperCase()}': ${has ? 'AUTHORISED' : 'DENIED'}`,
        has ? 't-success' : 't-error');
    });
  }

  function cmdAuth(args) {
    requireAuth(() => {
      const sub = args[0]?.toLowerCase();
      if (sub === 'refresh') {
        printLine('Refreshing session token…', 't-system');
        setTimeout(() => printLine('Token refreshed.', 't-success'), 800);
      } else {
        printLine('Authentication: ACTIVE', 't-success');
        printLine(`Logged in as ${Auth.getUser().uid}`, 't-muted');
      }
    });
  }

  function cmdClearance() {
    requireAuth(() => {
      const u = Auth.getUser();
      const label = Auth.CL_LABELS[u.clearance];
      printLine(`Clearance Level ${u.clearance} — ${label}`, 't-value');
    });
  }

  function cmdScope() {
    requireAuth(() => {
      const u = Auth.getUser();
      printLine('Active scopes:', 't-muted');
      u.scopes.forEach(s => printLine(`  ✓ ${s}`, 't-success'));
    });
  }

  function cmdSession() {
    requireAuth(() => {
      const u = Auth.getUser();
      printLine('SESSION DETAILS', 't-header');
      printLine(`  UID     : ${u.uid}`, 't-value');
      printLine(`  Type    : EPHEMERAL (no persistence)`, 't-value');
      printLine(`  Storage : sessionStorage (wiped on close)`, 't-value');
      printLine(`  Status  : ACTIVE`, 't-success');
    });
  }

  function cmdPermissions() {
    requireAuth(() => {
      const u = Auth.getUser();
      printLine('PERMISSIONS SUMMARY', 't-header');
      printDivider();
      printLine(`  Clearance               : ${u.clearance} — ${Auth.CL_LABELS[u.clearance]}`, 't-value');
      printLine(`  Scopes                  : ${u.scopes.join(', ')}`, 't-value');
      printLine(`  Database read           : ALL (via proxy)`, 't-value');
      const canWrite = Auth.hasScope('ARCHIVE') || Auth.hasScope('NETTECH');
      printLine(`  Database write          : ${canWrite ? 'AUTHORISED (scoped)' : 'DENIED'}`, canWrite ? 't-success' : 't-error');
      printLine(`  External access         : READ-ONLY (Strata-3 proxy)`, 't-value');
      printLine(`  IT system access        : ${Auth.hasScope('NETTECH') ? 'AUTHORISED' : 'DENIED'}`, Auth.hasScope('NETTECH') ? 't-success' : 't-error');
      printLine(`  Site-wide broadcast     : ${Auth.hasScope('SITEAUTHORITY') ? 'AUTHORISED' : 'DENIED'}`, Auth.hasScope('SITEAUTHORITY') ? 't-success' : 't-error');
      printLine(`  Lockdown authority      : ${Auth.hasClearance(4) ? 'AUTHORISED' : 'DENIED'}`, Auth.hasClearance(4) ? 't-success' : 't-error');
    });
  }

  function cmdScan(args) {
    const target = args[0] || 'local';
    printLine(`Security scan: ${target}`, 't-system');
    simulateOperation([
      { text: 'Enumerating attack surface…', delay: 350, variance: 200 },
      { text: 'Checking for anomalous process signatures…', delay: 400, variance: 200 },
      { text: 'Validating layer boundaries…', delay: 300, variance: 150 },
      { text: 'Testing proxy isolation…', delay: 350, variance: 150 },
    ]).then(() => {
      printBlank();
      if (Auth.hasScope('SECURITY')) {
        printLine('SCAN COMPLETE — No threats detected.', 't-success');
        printLine('  All layers nominal. Proxy intact. Audit log clean.', 't-muted');
      } else {
        printLine('SCAN COMPLETE — Basic check only (SECURITY scope required for full report).', 't-warn');
      }
    });
  }

  function cmdLock() {
    requireAuth(() => {
      printLine('Terminal locked. Authentication required to resume.', 't-warn');
      printQueue.then(() => {
        const users = StrataOS.getUsers();
        Auth.showCardModal(users, user => onLoginComplete(user));
      });
    });
  }

  // ── Database commands ──

  function cmdDb(args) {
    const sub = args[0]?.toLowerCase() || 'status';
    if (sub === 'list') {
      printLine('AVAILABLE DATABASES (read-only via proxy)', 't-header');
      printLine('  PERSONNEL-DB    — Personnel records (clearance 1+)', 't-value');
      printLine('  ARCHIVE-DB      — Document archive (clearance 2+)', 't-value');
      printLine('  ANOMALY-INDEX   — Anomaly catalogue (clearance 2+)', 't-value');
      printLine('  SITE-SYSTEMS    — Site infrastructure (NETTECH scope)', 't-value');
      printLine('  CLASSIFIED-DB   — Classified records (clearance 4+)', 't-value');
    } else {
      printLine('Database proxy: ACTIVE', 't-success');
      printLine('Access mode: READ-ONLY (proxy-enforced)', 't-muted');
      printLine('Use: db list | query [db] [term]', 't-muted');
    }
  }

  function cmdQuery(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: query [database] [term]', 't-muted'); return; }
      const db = args[0].toUpperCase(), term = args.slice(1).join(' ');
      if (db === 'CLASSIFIED-DB' && !Auth.hasClearance(4)) {
        printLine('[ ACCESS DENIED — clearance 4 required ]', 't-error'); return;
      }
      if (db === 'SITE-SYSTEMS' && !Auth.hasScope('NETTECH')) {
        printLine('[ ACCESS DENIED — NETTECH scope required ]', 't-error'); return;
      }
      printLine(`Querying ${db} for "${term}"…`, 't-system');
      simulateOperation([
        { text: 'Routing query through proxy…', delay: 300, variance: 200 },
        { text: 'Validating query format…', delay: 200, variance: 100 },
        { text: 'Awaiting database response…', delay: 400, variance: 300 },
        { text: 'Sanitising results…', delay: 250, variance: 100 },
      ]).then(() => {
        printBlank();
        printLine(`Results for "${term}" in ${db}:`, 't-value');
        printLine(`  [0001]  ${term.toUpperCase()} — record found (access permitted)`, 't-muted');
        printLine(`  [0002]  Related records: █████████ (REDACTED — clearance insufficient)`, 't-muted');
      });
    });
  }

  function cmdArchiveCmd(args) {
    requireClearance(2, () => {
      const sub = args[0]?.toLowerCase() || 'list';
      if (sub === 'list') {
        printLine('ARCHIVE DATABASE — RECENT DOCUMENTS', 't-header');
        printLine('  DOC-001   Containment Protocol Review 2024', 't-value');
        printLine('  DOC-002   Site Inspection Report Q3', 't-value');
        printLine('  DOC-003   Personnel Roster (RESTRICTED)', 't-value');
        printLine('  DOC-004   ████████████████ (REDACTED)', 't-muted');
        printLine('  Use Archive Writer in desktop for full editor access.', 't-muted');
      } else if (sub === 'open') {
        printLine('Open documents via the Archive Writer application (startx).', 't-muted');
      }
    });
  }

  function cmdWrite(args) {
    requireAuth(() => {
      const canWrite = Auth.hasScope('ARCHIVE') || Auth.hasScope('NETTECH');
      if (!canWrite) { printLine('[ ACCESS DENIED — write scope not in authorisation ]', 't-error'); return; }
      if (args.length < 2) { printLine('Usage: write [database] [data]', 't-muted'); return; }
      const db = args[0].toUpperCase(), data = args.slice(1).join(' ');
      printLine(`Requesting write authorisation to ${db}…`, 't-system');
      simulateOperation([
        { text: 'Validating write scope…', delay: 300, variance: 150 },
        { text: 'Submitting write request to Strata-4…', delay: 400, variance: 200 },
        { text: 'Awaiting authorisation gate…', delay: 500, variance: 300 },
        { text: 'Logging write operation to audit trail…', delay: 200, variance: 100 },
      ]).then(() => {
        printLine(`Write to ${db} AUTHORISED — data committed.`, 't-success');
      });
    });
  }

  function cmdExport(args) {
    requireClearance(2, () => {
      printLine('Export function restricted to Archive Writer application.', 't-muted');
      printLine('Launch via startx → Archive Writer.', 't-muted');
    });
  }

  // ── Comms ──

  function cmdAlert(args) {
    requireScope('SECURITY', () => {
      const level = args[0] || '1', msg = args.slice(1).join(' ') || 'unspecified';
      printLine(`ALERT LEVEL ${level} — ${msg.toUpperCase()}`, 't-error');
      StrataOS.showToast(`ALERT LVL ${level}: ${msg}`, 'error');
    });
  }

  function cmdBroadcast(args) {
    requireScope('SITEAUTHORITY', () => {
      const msg = args.join(' ') || '(empty)';
      printLine('Broadcasting to all terminals…', 't-system');
      setTimeout(() => {
        printLine(`BROADCAST: ${msg.toUpperCase()}`, 't-warn');
        StrataOS.showToast('BROADCAST SENT', 'warn');
      }, 800);
    });
  }

  function cmdMsg(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: msg [uid] [text]', 't-muted'); return; }
      const uid = args[0], text = args.slice(1).join(' ');
      printLine(`Routing message to ${uid}…`, 't-system');
      setTimeout(() => printLine(`Message delivered to ${uid}.`, 't-success'), 800);
    });
  }

  function cmdNotify(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: notify [uid] [text]', 't-muted'); return; }
      const uid = args[0], text = args.slice(1).join(' ');
      setTimeout(() => {
        printLine(`Notification sent to ${uid}.`, 't-success');
        StrataOS.showToast(`NOTIFY → ${uid}: ${text}`, 'success');
      }, 600);
    });
  }

  // ── Crypto ──

  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).toUpperCase().padStart(8, '0');
  }

  function cmdEncrypt(args) {
    requireClearance(1, () => {
      const text = args.join(' ');
      if (!text) { printLine('Usage: encrypt [text]', 't-muted'); return; }
      const fake = btoa(text).replace(/=/g,'').toUpperCase().substring(0,32) + simpleHash(text);
      printLine('Encrypting via STRATA cipher (simulated)…', 't-system');
      setTimeout(() => printLine(`  CIPHER: ${fake}`, 't-value'), 600);
    });
  }

  function cmdDecrypt(args) {
    requireClearance(3, () => {
      printLine('Decryption requires Strata-2 processing layer.', 't-muted');
      printLine('Forward hash to a clearance-3 operator for processing.', 't-muted');
    });
  }

  function cmdHash(args) {
    const text = args.join(' ');
    if (!text) { printLine('Usage: hash [text]', 't-muted'); return; }
    const h = simpleHash(text);
    printLine(`FNV-32: ${h}`, 't-value');
  }

  function cmdChecksum(args) {
    requireAuth(() => {
      const file = args[0];
      if (!file) { printLine('Usage: checksum [file]', 't-muted'); return; }
      printLine(`Checksum for ${file}: ${simpleHash(file + Date.now())}  [SHA-256 simulated]`, 't-value');
    });
  }

  // ── Misc ──

  function cmdKill(args) {
    requireClearance(3, () => {
      const pid = args[0];
      if (!pid) { printLine('Usage: kill [pid]', 't-muted'); return; }
      const safe = ['0001','0002','0003']; // protected
      if (safe.includes(pid)) { printLine(`[ Cannot terminate protected process ${pid} ]`, 't-error'); return; }
      printLine(`Terminating process ${pid}…`, 't-warn');
      setTimeout(() => printLine(`Process ${pid} terminated.`, 't-success'), 500);
    });
  }

  function cmdStress() {
    requireClearance(3, () => {
      printLine('Stress test initiated (simulated)…', 't-warn');
      printProgress('CPU stress…', 2000, 20).then(() => {
        printLine('Stress test complete — no anomalies.', 't-success');
      });
    });
  }

  return {
    init,
    runBoot,
    printLine,
    printBlank,
    printDivider,
    printProgress,
    simulateOperation,
    clear,
    setOutput(el) { outputEl = el; printQueue = Promise.resolve(); },
    setInput(el) { inputEl = el; },
    setPrompt(el) { promptEl = el; },
    updatePrompt,
    lockInput() { locked = true; },
    unlockInput() { locked = false; },
    parseCommand,
    getTheme() { return theme; }
  };

})();
