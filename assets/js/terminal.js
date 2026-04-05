// === TERMINAL.JS — STRATA OS TERMINAL ENGINE ===

const Terminal = (() => {

  let outputEl = null;
  let inputEl = null;
  let promptEl = null;
  let history = [];
  let historyIndex = -1;
  let locked = false;
  let theme = 'dark';
  let isDesktopTerminal = false;
  let pendingCardLogin = false;

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
    return printLine('\u2500'.repeat(60), 't-divider', delay);
  }

  function scrollBottom() {
    if (outputEl) outputEl.scrollTop = outputEl.scrollHeight;
  }

  function clear() {
    if (outputEl) outputEl.innerHTML = '';
    printQueue = Promise.resolve();
  }

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
        if (step >= steps) { clearInterval(interval); resolve(); }
      }, durationMs / steps);
    });
  }

  async function simulateOperation(steps) {
    for (const step of steps) {
      const delay = step.delay ?? (300 + Math.random() * (step.variance ?? 400));
      await printLine(`  ${step.icon ?? '\u00b7'} ${step.text}`, step.cls ?? 't-muted', delay);
    }
  }

  // ── Boot sequence ──────────────────────────────────────────────────────

  async function runBoot() {
    locked = true;
    clear();

    const lines = [
      { text: 'STRATA OS v4.2.1 \u2014 FOUNDATION HARDENED ENVIRONMENT', cls: 't-header', delay: 0 },
      { text: '\u2500'.repeat(60), cls: 't-divider', delay: 60 },
      { text: 'Copyright \u00a9 The Foundation. All rights reserved.', cls: 't-muted', delay: 40 },
      { text: 'Unauthorised access constitutes a Class-IV breach.', cls: 't-muted', delay: 30 },
      { text: '', delay: 40 },
      { text: 'BEDROCK LAYER VERIFICATION', cls: 't-system', delay: 80 },
    ];
    for (const l of lines) await printLine(l.text, l.cls, l.delay);

    await printProgress('Verifying hardware integrity hash\u2026', 900, 18);
    await printLine('  \u2713 Bedrock signature VALID', 't-success', 80);
    await printLine('  \u2713 Boot partition write-protection CONFIRMED', 't-success', 60);
    await printBlank(40);

    await printLine('KERNEL INITIALISATION \u2014 STRATA-5', 't-system', 60);
    await printProgress('Loading kernel modules\u2026', 700, 14);
    await printLine('  \u2713 Process scheduler ONLINE', 't-success', 60);
    await printLine('  \u2713 Memory subsystem INITIALISED', 't-success', 50);
    await printLine('  \u2713 Hardware abstraction layer READY', 't-success', 50);
    await printBlank(40);

    await printLine('SYSTEM CONTROL LAYER \u2014 STRATA-4', 't-system', 60);
    await printProgress('Applying security policy\u2026', 600, 12);
    await printLine('  \u2713 Access control matrix LOADED', 't-success', 50);
    await printLine('  \u2713 Audit logging daemon ACTIVE', 't-success', 50);
    await printBlank(40);

    await printLine('PROXY INTERFACE LAYER \u2014 STRATA-3', 't-system', 60);
    await printProgress('Establishing isolated proxy channels\u2026', 800, 16);
    await printLine('  \u2713 External database proxies SANDBOXED', 't-success', 50);
    await printLine('  \u2713 Read-only enforcement ACTIVE', 't-success', 50);
    await printLine('  \u2713 Write-authorisation gate STANDBY', 't-success', 50);
    await printBlank(40);

    await printLine('PROCESSING & VALIDATION LAYER \u2014 STRATA-2', 't-system', 60);
    await printProgress('Loading sanitisation filters\u2026', 600, 12);
    await printLine('  \u2713 Input validation engine READY', 't-success', 50);
    await printLine('  \u2713 Cognitohazard filter v3.1 LOADED', 't-success', 50);
    await printBlank(40);

    await printLine('APPLICATION LAYER \u2014 STRATA-1', 't-system', 60);
    await printProgress('Mounting application environment\u2026', 700, 14);
    await printLine('  \u2713 Session environment CLEAN (ephemeral)', 't-success', 50);
    await printLine('  \u2713 Application manifests VERIFIED', 't-success', 50);
    await printBlank(40);

    await printLine('INTERFACE LAYER \u2014 STRATA-0', 't-system', 60);
    await printProgress('Initialising terminal interface\u2026', 500, 10);
    await printLine('  \u2713 Display subsystem READY', 't-success', 50);
    await printBlank(50);

    await printDivider(60);
    await printLine('ALL LAYERS NOMINAL \u2014 SYSTEM READY', 't-success', 80);
    await printDivider(40);
    await printBlank(60);

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
    if (!users || users.length === 0) {
      printLine('[ ERROR: No user accounts found — check STRATA_USERS data ]', 't-error');
      return;
    }
    printLine('Awaiting keycard presentation…', 't-system', 200).then(() => {
      printLine('', '', 200);
      printLine('Press <span class="t-system">ENTER</span> upon presenting keycard.', '', 400);
      locked = false;
      pendingCardLogin = true;
      updatePrompt();
    });
  }

  // ── onLoginComplete ─────────────────────────────────────────────────────
  // Called after successful authentication. Checks clearance before granting
  // terminal access — CL0 users are shown a denial message and the session
  // is terminated.

  async function onLoginComplete(user) {
    locked = true;
    clear();

    // ── CL0 guard ───────────────────────────────────────────────────────
    if (!user || user.clearance < 1) {
      await printLine('AUTHENTICATION FAILED', 't-error', 0);
      await printDivider(40);
      await printBlank(30);
      await printLine('  CLEARANCE LEVEL 0 \u2014 NO SYSTEM ACCESS', 't-error', 60);
      await printBlank(20);
      await printLine('  Your credentials were accepted but your clearance level', 't-muted', 40);
      await printLine('  does not permit access to the STRATA terminal environment.', 't-muted', 30);
      await printBlank(20);
      await printLine('  This access attempt has been logged.', 't-warn', 40);
      await printBlank(30);
      await printDivider(40);
      await printLine('  Type <span class="t-system">logout</span> to terminate this session.', '', 40);
      await printBlank(20);
      printQueue.then(() => {
        locked = false;
        updatePrompt();
      });
      return;
    }

    // ── Normal login flow ────────────────────────────────────────────────
    const cl   = Auth.CL_LABELS[user.clearance] || 'UNKNOWN';
    const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP';
    const site = user.tetheredSite
      ? `${user.tetheredSite.name} \u2014 ${user.tetheredSite.description}`
      : 'LOCATION UNRESOLVED \u2014 SITE ASSIGNMENT PENDING';

    await printLine('AUTHENTICATION SUCCESSFUL', 't-success', 0);
    await printDivider(40);
    await printBlank(30);

    await simulateOperation([
      { text: 'Validating clearance token\u2026',              cls: 't-muted', delay: 300, variance: 200 },
      { text: 'Checking scope authorisations\u2026',           cls: 't-muted', delay: 250, variance: 150 },
      { text: 'Establishing session sandbox\u2026',            cls: 't-muted', delay: 200, variance: 200 },
      { text: 'Binding ephemeral session key\u2026',           cls: 't-muted', delay: 280, variance: 150 },
      { text: 'Resolving tethered site via geolocation\u2026', cls: 't-muted', delay: 350, variance: 300 },
      { text: 'Applying user permissions matrix\u2026',        cls: 't-muted', delay: 220, variance: 100 },
    ]);
    await printBlank(40);

    await printLine('SESSION ESTABLISHED', 't-success', 80);
    await printDivider(40);
    await printBlank(30);

    await printLine(`  WELCOME, ${user.title.toUpperCase()} ${user.name.toUpperCase()}`, 't-header', 60);
    await printBlank(20);
    await printLine(`  UID             : ${user.uid}`,                       't-value', 40);
    await printLine(`  ROLE            : ${user.role}`,                      't-value', 30);
    await printLine(`  CLEARANCE       : ${user.clearance} \u2014 ${cl}`,   't-value', 30);
    await printLine(`  SCOPES          : ${user.scopes.join(', ')}`,         't-value', 30);
    await printLine(`  TETHERED SITE   : ${site}`,                          't-value', 30);
    await printLine(`  SESSION TYPE    : EPHEMERAL (data will not persist)`, 't-value', 30);
    await printLine(`  TERMINAL        : STRATA-0 / ${deviceType}`,         't-value', 30);
    await printBlank(40);
    await printDivider(40);
    await printBlank(30);

    const hasScopes = user.scopes.length > 0 &&
      !(user.scopes.length === 1 && user.scopes[0] === '');
    if (hasScopes) {
      await printLine('Type <span class="t-system">help</span> for available commands.', '', 40);
      await printLine('Type <span class="t-system">startx</span> to launch the graphical desktop environment.', '', 30);
      await printLine('Type <span class="t-system">logout</span> to end your session.', '', 30);
    } else {
      await printLine('Your account has no terminal scope authorisation.', 't-warn', 40);
      await printLine('Type <span class="t-system">logout</span> to end your session.', '', 30);
    }

    printQueue.then(() => {
      locked = false;
      updatePrompt();
    });
  }

  function updatePrompt() {
    if (!promptEl) return;
    const user = Auth.getUser();
    promptEl.textContent = user ? `STRATA@${user.uid} ~$ ` : 'STRATA ~$ ';
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

    if (pendingCardLogin) {
      pendingCardLogin = false;
      locked = true;
      const users = StrataOS.getUsers();
      printLine('Reading keycard…', 't-system');
      printQueue.then(() => setTimeout(() => {
        Auth.showCardModal(users, user => onLoginComplete(user));
      }, 400));
      return;
    }

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
    const user = Auth.getUser();
    const hasAnyScope = user && user.scopes.length > 0 &&
      !(user.scopes.length === 1 && user.scopes[0] === '');
    const restrictedUser = user && !hasAnyScope;

    if (restrictedUser) {
      const cmd = raw.trim().toLowerCase();
      if (cmd === 'logout') return cmdLogout();
      printLine('[ ACCESS DENIED — your account has no terminal scopes ]', 't-error');
      printLine('  Type <span class="t-system">logout</span> to end your session.', '');
      return;
    }

    const parts = raw.trim().split(/\s+/);
    const cmd  = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
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
      case 'net':        return cmdNet(args);
      case 'ping':       return cmdPing(args);
      case 'traceroute': return cmdTraceroute(args);
      case 'ifconfig':   return cmdIfconfig();
      case 'connect':    return cmdConnect(args);
      case 'disconnect': return cmdDisconnect(args);
      case 'proxy':      return cmdProxy(args);
      case 'vpn':        return cmdVpn(args);
      case 'firewall':   return cmdFirewall(args);
      case 'access':      return cmdAccess(args);
      case 'auth':        return cmdAuth(args);
      case 'clearance':   return cmdClearance();
      case 'scope':       return cmdScope();
      case 'session':     return cmdSession();
      case 'permissions': return cmdPermissions();
      case 'scan':        return cmdScan(args);
      case 'lock':        return cmdLock();
      case 'db':      return cmdDb(args);
      case 'query':   return cmdQuery(args);
      case 'archive': return cmdArchiveCmd(args);
      case 'write':   return cmdWrite(args);
      case 'export':  return cmdExport(args);
      case 'alert':     return cmdAlert(args);
      case 'broadcast': return cmdBroadcast(args);
      case 'msg':       return cmdMsg(args);
      case 'notify':    return cmdNotify(args);
      case 'encrypt':  return cmdEncrypt(args);
      case 'decrypt':  return cmdDecrypt(args);
      case 'hash':     return cmdHash(args);
      case 'checksum': return cmdChecksum(args);
      case 'kill':    return cmdKill(args);
      case 'stress':  return cmdStress();
      case 'verbose': return printLine('[ verbose mode not available in STRATA-0 ]', 't-warn');
      case 'set':     return printLine('[ use env to view variables; set is restricted ]', 't-warn');
      case 'keycard':
      case 'login':
      case 'card':
        if (!Auth.getUser()) {
          pendingCardLogin = false;
          const users = StrataOS.getUsers();
          printLine('Presenting keycard…', 't-system');
          printQueue.then(() => setTimeout(() => {
            Auth.showCardModal(users, user => onLoginComplete(user));
          }, 400));
        } else {
          printLine('[ already authenticated ]', 't-warn');
        }
        return;

      default:
        if (!Auth.getUser()) {
          printLine('[ authentication required — press <span class="t-system">ENTER</span> upon presenting keycard ]', 't-error');
          return;
        }
        printLine(`[ command not found: ${escHtml(cmd)} — type 'help' ]`, 't-error');
    }
  }

  // ── Auth helpers ─────────────────────────────────────────────────────────

  function requireAuth(fn) {
    if (!Auth.getUser()) {
      printLine('[ authentication required ]', 't-error');
      return;
    }
    fn();
  }

  function requireClearance(level, fn) {
    if (!Auth.hasClearance(level)) {
      printLine(`[ ACCESS DENIED \u2014 clearance level ${level} required ]`, 't-error');
      printLine('  Incident has been logged.', 't-warn');
      return;
    }
    fn();
  }

  function requireScope(scope, fn) {
    if (!Auth.hasScope(scope)) {
      printLine(`[ ACCESS DENIED \u2014 scope '${scope}' not in your authorisation ]`, 't-error');
      return;
    }
    fn();
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  function cmdHelp(args) {
    if (args[0]) return cmdMan(args);
    printLine('STRATA OS \u2014 COMMAND REFERENCE', 't-header');
    printDivider();
    const sections = [
      { title: 'GENERAL', cmds: [
        ['help [cmd]','Show this help or command details'],
        ['clear','Clear terminal output'],
        ['whoami','Display current session identity'],
        ['status','System and session status summary'],
        ['version','STRATA version information'],
        ['uptime','System uptime'],
        ['date','Current date and time'],
        ['echo [text]','Print text'],
        ['history','Command history'],
        ['env','Show environment variables'],
        ['logout','Terminate session'],
        ['startx','Launch desktop environment (clearance 1+ required)'],
        ['theme [dark|light]','Toggle display theme'],
      ]},
      { title: 'SYSTEM', cmds: [
        ['sysinfo','Hardware and OS information'],
        ['ps','Running processes'],
        ['top','Process resource usage'],
        ['mem','Memory usage report'],
        ['disk','Disk usage report'],
        ['log [n]','View system log (last n entries)'],
        ['audit [uid]','View audit trail'],
        ['diagnostics','Run system diagnostics'],
        ['benchmark','Run performance benchmark'],
        ['telemetry','View system telemetry'],
        ['reboot','Reboot terminal session'],
        ['shutdown','Initiate system shutdown'],
        ['panic','Emergency halt (requires clearance 5)'],
        ['lockdown [code]','Initiate site lockdown (requires clearance 4+)'],
      ]},
      { title: 'FILESYSTEM', cmds: [
        ['ls [path]','List directory contents'],
        ['cd [path]','Change directory'],
        ['pwd','Print working directory'],
        ['cat [file]','View file contents'],
        ['mkdir [name]','Create directory'],
        ['rm [file]','Delete file'],
        ['touch [name]','Create empty file'],
        ['cp [src] [dst]','Copy file'],
        ['mv [src] [dst]','Move/rename file'],
        ['find [term]','Search filesystem'],
      ]},
      { title: 'NETWORK', cmds: [
        ['net [status|routes|stats]','Network information'],
        ['ping [host]','Ping a host'],
        ['traceroute [host]','Trace network route'],
        ['ifconfig','Interface configuration'],
        ['connect [endpoint]','Connect to remote endpoint'],
        ['disconnect','Disconnect active session'],
        ['proxy [status|list]','Proxy interface status'],
        ['vpn [status|connect|disconnect]','VPN management'],
        ['firewall [rules|status]','Firewall configuration'],
      ]},
      { title: 'ACCESS & SECURITY', cmds: [
        ['access [check] [scope]','Check access permissions'],
        ['auth [status|refresh]','Authentication status'],
        ['clearance','View clearance level'],
        ['scope','List active scopes'],
        ['session','Session details'],
        ['permissions','Full permissions summary'],
        ['scan [target]','Security scan'],
        ['lock','Lock terminal'],
      ]},
      { title: 'DATABASE', cmds: [
        ['db [status|list]','Database connection status'],
        ['query [db] [term]','Query read-only database'],
        ['archive [list|open]','Archive database access'],
        ['write [db] [data]','Write to authorised database (scope required)'],
        ['export [db] [format]','Export query results'],
      ]},
      { title: 'COMMUNICATIONS', cmds: [
        ['alert [level] [msg]','Send alert (security scope)'],
        ['broadcast [msg]','Site-wide broadcast (authority required)'],
        ['msg [uid] [text]','Message a specific user'],
        ['notify [uid] [text]','Send system notification'],
      ]},
      { title: 'CRYPTOGRAPHIC', cmds: [
        ['encrypt [text]','Encrypt string (simulated)'],
        ['decrypt [hash]','Decrypt (clearance 3+ required)'],
        ['hash [text]','SHA-style hash of input'],
        ['checksum [file]','File checksum verification'],
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
    printLine('  Commands marked ACCESS DENIED require elevated clearance or scope.', 't-muted');
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
      const u    = Auth.getUser();
      const site = u.tetheredSite ? u.tetheredSite.name : 'UNRESOLVED';
      printLine('SYSTEM STATUS', 't-header');
      printDivider();
      printLine(`  Session     : ACTIVE (ephemeral)`, 't-value');
      printLine(`  User        : ${u.uid} \u2014 ${u.name}`, 't-value');
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
    printLine('Foundation Hardened Environment', 't-muted');
    printLine('Kernel: STRATA-K 2.7.4  |  Bedrock: 1.0.0-IMMUTABLE', 't-muted');
  }

  function cmdUptime() {
    const ms = performance.now();
    const s  = Math.floor(ms/1000);
    const m  = Math.floor(s/60);
    const h  = Math.floor(m/60);
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
      printLine('Terminating session\u2026', 't-warn');
      printLine('Wiping ephemeral session data\u2026', 't-muted');
      printLine('Session ended. Goodbye.', 't-success');
      locked = true; // prevent further input during teardown
      printQueue.then(() => setTimeout(() => Auth.logout(), 1200));
    });
  }

  // ── cmdStartX — requires clearance >= 1 ─────────────────────────────────
  function cmdStartX() {
    requireAuth(() => {
      if (!Auth.hasClearance(1)) {
        printLine('[ ACCESS DENIED \u2014 desktop environment requires clearance level 1+ ]', 't-error');
        printLine('  Incident has been logged.', 't-warn');
        return;
      }
      if (isDesktopTerminal) {
        printLine('[ already in graphical environment ]', 't-warn');
        return;
      }
      printLine('Launching graphical desktop environment\u2026', 't-system');
      simulateOperation([
        { text: 'Compositing display server\u2026',    delay: 300, variance: 200 },
        { text: 'Loading window manager\u2026',        delay: 250, variance: 150 },
        { text: 'Mounting application manifests\u2026', delay: 280, variance: 200 },
        { text: 'Applying user environment\u2026',     delay: 200, variance: 100 },
      ]).then(() => {
        printLine('Desktop environment READY', 't-success');
        printQueue.then(() => setTimeout(() => Desktop.launch(), 800));
      });
    });
  }

  function cmdTheme(args) {
    const t = args[0]?.toLowerCase();
    if (t === 'dark') {
      document.body.classList.add('dark-mode'); theme = 'dark';
      printLine('Theme set to DARK.', 't-success');
    } else if (t === 'light') {
      document.body.classList.remove('dark-mode'); theme = 'light';
      printLine('Theme set to LIGHT.', 't-success');
    } else {
      if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode'); theme = 'light';
        printLine('Theme set to LIGHT.', 't-success');
      } else {
        document.body.classList.add('dark-mode'); theme = 'dark';
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
      startx:   'startx \u2014 launches the STRATA graphical desktop. Requires clearance level 1 or higher.',
      logout:   'logout \u2014 terminates the current session and wipes all ephemeral data.',
      theme:    'theme [dark|light] \u2014 switches display theme. Toggles without argument.',
      db:       'db [status|list] \u2014 shows database proxy connection status.',
      query:    'query [database] [term] \u2014 perform a read-only query against an authorised database proxy.',
      write:    'write [database] [data] \u2014 write to a database. Requires ARCHIVE or NETTECH scope.',
      lockdown: 'lockdown [code] \u2014 initiates site lockdown protocol. Requires clearance 4 and SECURITY scope.',
      panic:    'panic \u2014 triggers AEGIS emergency halt. Requires clearance 5.',
      scan:     'scan [target] \u2014 runs a security scan. SECURITY scope required for full results.',
    };
    if (docs[topic]) {
      printLine(`MAN \u2014 ${topic.toUpperCase()}`, 't-header');
      printDivider();
      printLine(`  ${docs[topic]}`, 't-muted');
    } else {
      printLine(`[ no manual entry for '${topic}' ]`, 't-warn');
    }
  }

  function cmdInfo(args) { cmdMan(args); }

  // ── System commands ───────────────────────────────────────────────────────

  function cmdSysinfo() {
    printLine('SYSTEM INFORMATION', 't-header');
    printDivider();
    printLine(`  OS            : STRATA OS v4.2.1`, 't-value');
    printLine(`  Build         : HARDENED / CLASSIFIED`, 't-value');
    printLine(`  Architecture  : STRATIFIED (7 layers)`, 't-value');
    printLine(`  Kernel        : STRATA-K 2.7.4`, 't-value');
    printLine(`  Platform      : ${/Mobi|Android/i.test(navigator.userAgent) ? 'MOBILE' : 'DESKTOP'}`, 't-value');
    printLine(`  Locale        : ${navigator.language}`, 't-value');
    printLine(`  Online        : ${navigator.onLine ? 'YES' : 'NO'}`, 't-value');
    printLine(`  Cores         : ${navigator.hardwareConcurrency || '?'}`, 't-value');
    printLine(`  Memory        : ${navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'CLASSIFIED'}`, 't-value');
  }

  function cmdPs() {
    printLine('PROCESS LIST', 't-header');
    printDivider();
    const procs = [
      ['0001','bedrock-watchdog','0.0','12.4'],
      ['0002','strata-kernel','0.1','48.2'],
      ['0003','sysctl','0.0','8.1'],
      ['0004','audit-daemon','0.2','14.6'],
      ['0005','proxy-sandbox','0.3','22.8'],
      ['0006','cogfilt-v3','0.1','18.3'],
      ['0007','session-manager','0.4','31.2'],
      ['0008','strata-terminal','1.2','44.1'],
      ['0009','net-monitor','0.1','9.8'],
    ];
    printLine('  PID   NAME                   CPU%   MEM(MB)', 't-muted');
    for (const [pid,name,cpu,mem] of procs) {
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
    printLine('MEMORY REPORT', 't-header'); printDivider();
    printLine('  Total          : 2048 MB', 't-value');
    printLine('  Used           : 312 MB', 't-value');
    printLine('  Available      : 1736 MB', 't-value');
    printLine('  Ephemeral heap : 44 MB (session)', 't-value');
    printLine('  Kernel reserve : 128 MB (locked)', 't-value');
  }

  function cmdDisk() {
    printLine('DISK USAGE', 't-header'); printDivider();
    printLine('  /bedrock       :  128 MB  (READ-ONLY, write-protected)', 't-value');
    printLine('  /system        :  2.1 GB  (READ-ONLY)', 't-value');
    printLine('  /session       :  44 MB   (EPHEMERAL)', 't-value');
    printLine('  /archive-proxy :  REMOTE  (read-only via proxy)', 't-value');
  }

  const LOG_ENTRIES = [
    'Kernel initialised \u2014 all layers nominal',
    'Audit daemon started \u2014 log rotation ACTIVE',
    'Proxy sandbox established \u2014 3 channels OPEN',
    'Cognitohazard filter v3.1 LOADED',
    'Session manager READY',
    'Terminal STRATA-0 ONLINE',
    'Authentication request received',
    'Keycard verified \u2014 authentication SUCCESSFUL',
    'Session established \u2014 ephemeral mode',
    'User environment applied',
  ];

  function cmdLog(args) {
    const n = parseInt(args[0]) || LOG_ENTRIES.length;
    printLine('SYSTEM LOG', 't-header'); printDivider();
    LOG_ENTRIES.slice(-n).forEach((e,i) =>
      printLine(`  [${String(i).padStart(4,'0')}]  ${e}`, 't-muted'));
  }

  function cmdAudit(args) {
    requireAuth(() => {
      requireScope('SECURITY', () => {
        const target = args[0] || Auth.getUser().uid;
        printLine(`AUDIT TRAIL \u2014 ${target}`, 't-header'); printDivider();
        printLine(`  AUTH  LOGIN     Keycard presented \u2014 verified`, 't-value');
        printLine(`  AUTH  PASS      Password sequence completed`, 't-value');
        printLine(`  SESS  CREATE    Ephemeral session established`, 't-value');
        printLine(`  CMD   TERMINAL  Various terminal commands`, 't-muted');
        printLine(`  (Full audit available to clearance 4+)`, 't-muted');
      });
    });
  }

  function cmdDiagnostics() {
    printLine('RUNNING DIAGNOSTICS\u2026', 't-system');
    simulateOperation([
      { text: 'Checking Bedrock layer integrity\u2026',    delay: 400, variance: 200 },
      { text: 'Testing kernel process isolation\u2026',    delay: 350, variance: 150 },
      { text: 'Verifying proxy sandbox boundaries\u2026',  delay: 380, variance: 200 },
      { text: 'Validating cognitohazard filter\u2026',     delay: 300, variance: 100 },
      { text: 'Checking audit daemon health\u2026',        delay: 280, variance: 150 },
      { text: 'Testing session entropy\u2026',             delay: 250, variance: 100 },
    ]).then(() => {
      printBlank();
      printLine('DIAGNOSTICS COMPLETE \u2014 ALL SYSTEMS NOMINAL', 't-success');
    });
  }

  function cmdBenchmark() {
    printLine('RUNNING PERFORMANCE BENCHMARK\u2026', 't-system');
    printLine('(simulated)', 't-muted');
    printProgress('Integer arithmetic\u2026', 800, 16).then(() =>
    printLine('  Score: 14,822 ops/ms', 't-value')).then(() =>
    printProgress('Memory bandwidth\u2026', 700, 14).then(() =>
    printLine('  Score: 8,441 MB/s', 't-value'))).then(() =>
    printProgress('I/O throughput\u2026', 600, 12).then(() =>
    printLine('  Score: 312 MB/s (proxy-limited)', 't-value'))).then(() => {
      printBlank();
      printLine('Benchmark complete.', 't-success');
    });
  }

  function cmdTelemetry() {
    requireAuth(() => {
      printLine('TELEMETRY SNAPSHOT', 't-header'); printDivider();
      printLine(`  Proxy requests (session) : ${Math.floor(Math.random()*20)+2}`, 't-value');
      printLine(`  Commands issued          : ${history.length}`, 't-value');
      printLine(`  Auth events              : 1 login`, 't-value');
      printLine(`  Memory delta (session)   : +${Math.floor(Math.random()*12)+2} MB`, 't-value');
      printLine(`  Network I/O              : ${Math.floor(Math.random()*400)+100} KB`, 't-value');
    });
  }

  function cmdDebug(args) {
    requireClearance(3, () => {
      printLine('DEBUG OUTPUT (Strata-0 surface only)', 't-warn'); printDivider();
      printLine('  Session storage keys: ' + Object.keys(sessionStorage).join(', '), 't-muted');
      printLine('  Theme: ' + theme, 't-muted');
      printLine('  History length: ' + history.length, 't-muted');
    });
  }

  function cmdReboot() {
    requireAuth(() => {
      printLine('Initiating terminal reboot sequence\u2026', 't-warn');
      simulateOperation([
        { text: 'Flushing ephemeral session data\u2026', delay: 300 },
        { text: 'Terminating application processes\u2026', delay: 250 },
        { text: 'Clearing memory\u2026', delay: 200 },
      ]).then(() => {
        printLine('Reboot complete \u2014 reinitialising\u2026', 't-success');
        printQueue.then(() => setTimeout(() => location.reload(), 1200));
      });
    });
  }

  function cmdShutdown() {
    requireClearance(3, () => {
      printLine('SHUTDOWN INITIATED', 't-warn');
      printLine('Session will terminate in 5 seconds.', 't-muted');
      locked = true;
      printQueue.then(() => setTimeout(() => Auth.logout(), 5000));
    });
  }

  function cmdPanic() {
    requireClearance(5, () => {
      printLine('\u26a0 AEGIS EMERGENCY HALT INITIATED \u26a0', 't-error');
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
        printLine(`SITE LOCKDOWN INITIATED \u2014 CODE: ${code}`, 't-error');
        printLine('Broadcasting to all connected terminals\u2026', 't-warn');
        simulateOperation([
          { text: 'Notifying site security\u2026',          delay: 400, variance: 200 },
          { text: 'Locking containment access points\u2026', delay: 350, variance: 150 },
          { text: 'Initiating headcount protocol\u2026',    delay: 300, variance: 100 },
          { text: 'Broadcasting alert on all channels\u2026', delay: 280, variance: 100 },
        ]).then(() => {
          printLine('LOCKDOWN ACTIVE \u2014 AWAIT FURTHER INSTRUCTION', 't-error');
          StrataOS.showToast('LOCKDOWN INITIATED \u2014 SEE TERMINAL', 'error');
        });
      });
    });
  }

  // ── Filesystem ────────────────────────────────────────────────────────────

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
      const dirs  = this.dirs().filter(d => {
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
      if (dirs.length === 0 && files.length === 0) { printLine('(empty)', 't-muted'); return; }
      printLine(`Contents of ${target}:`, 't-muted');
      dirs.forEach(d  => printLine(`  \ud83d\udcc1  ${d.split('/').pop()}/`, 't-system'));
      files.forEach(f => printLine(`  \ud83d\udcc4  ${f.split('/').pop()}`, 't-value'));
    });
  }

  function cmdCd(args) {
    requireAuth(() => {
      const target = FS.resolve(args[0] || '/home');
      if (!checkFsAccess(target)) { printLine('[ ACCESS DENIED ]', 't-error'); return; }
      if (!FS.dirs().includes(target)) { printLine(`[ no such directory: ${target} ]`, 't-error'); return; }
      FS.cwd = target; updatePrompt();
    });
  }

  function cmdPwd()  { requireAuth(() => printLine(FS.cwd, 't-value')); }

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
      dirs.push(path); FS.saveDirs(dirs);
      printLine(`Created: ${path}`, 't-success');
    });
  }

  function cmdTouch(args) {
    requireAuth(() => {
      if (!args[0]) { printLine('Usage: touch [name]', 't-muted'); return; }
      const path = FS.resolve(args[0]);
      const files = FS.files();
      files[path] = files[path] || ''; FS.saveFiles(files);
      printLine(`Created: ${path}`, 't-success');
    });
  }

  function cmdRm(args) {
    requireAuth(() => {
      if (!args[0]) { printLine('Usage: rm [file]', 't-muted'); return; }
      const path = FS.resolve(args[0]);
      const files = FS.files();
      if (!files[path]) { printLine(`[ not found: ${path} ]`, 't-error'); return; }
      delete files[path]; FS.saveFiles(files);
      printLine(`Removed: ${path}`, 't-success');
    });
  }

  function cmdCp(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: cp [src] [dst]', 't-muted'); return; }
      const src = FS.resolve(args[0]), dst = FS.resolve(args[1]);
      const files = FS.files();
      if (!files[src]) { printLine(`[ source not found: ${src} ]`, 't-error'); return; }
      files[dst] = files[src]; FS.saveFiles(files);
      printLine(`Copied ${src} \u2192 ${dst}`, 't-success');
    });
  }

  function cmdMv(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: mv [src] [dst]', 't-muted'); return; }
      const src = FS.resolve(args[0]), dst = FS.resolve(args[1]);
      const files = FS.files();
      if (!files[src]) { printLine(`[ source not found: ${src} ]`, 't-error'); return; }
      files[dst] = files[src]; delete files[src]; FS.saveFiles(files);
      printLine(`Moved ${src} \u2192 ${dst}`, 't-success');
    });
  }

  function cmdFind(args) {
    requireAuth(() => {
      const term = args[0];
      if (!term) { printLine('Usage: find [term]', 't-muted'); return; }
      const files = Object.keys(FS.files()).filter(f => f.includes(term));
      const dirs  = FS.dirs().filter(d => d.includes(term));
      if (files.length + dirs.length === 0) { printLine('No results.', 't-muted'); return; }
      dirs.forEach(d  => printLine(`  \ud83d\udcc1  ${d}`, 't-system'));
      files.forEach(f => printLine(`  \ud83d\udcc4  ${f}`, 't-value'));
    });
  }

  // ── Network commands ──────────────────────────────────────────────────────

  function cmdNet(args) {
    const sub = args[0]?.toLowerCase() || 'status';
    if (sub === 'status') {
      printLine('NETWORK STATUS', 't-header');
      printLine('  Interface    : STRATA-ETH0 (virtual)', 't-value');
      printLine('  Address      : 10.0.\u2588\u2588.\u2588\u2588 / 24 (CLASSIFIED)', 't-value');
      printLine('  Gateway      : 10.0.\u2588\u2588.1', 't-value');
      printLine('  DNS          : FOUNDATION-DNS-01', 't-value');
      printLine('  Proxy        : ACTIVE (Strata-3)', 't-value');
      printLine('  External     : READ-ONLY via sandboxed proxy', 't-value');
    } else if (sub === 'routes') {
      printLine('ROUTING TABLE', 't-header');
      printLine('  10.0.0.0/8      \u2192 INTERNAL (LAN)', 't-value');
      printLine('  172.16.0.0/12   \u2192 PROXY-CHAIN-01', 't-value');
      printLine('  0.0.0.0/0       \u2192 PROXY-SANDBOX-GATEWAY', 't-value');
    } else if (sub === 'stats') {
      printLine('NETWORK STATS (session)', 't-header');
      printLine(`  Bytes in  : ${(Math.random()*1024*200)|0} B`, 't-value');
      printLine(`  Bytes out : ${(Math.random()*1024*50)|0} B`, 't-value');
      printLine('  Errors    : 0', 't-value');
    }
  }

  function cmdPing(args) {
    const host = args[0] || '10.0.1.1';
    printLine(`PING ${host} \u2014 STRATA proxy route`, 't-system');
    const delays = [8,8,8,8].map(d => d + Math.floor(Math.random()*20));
    delays.forEach((d,i) =>
      printLine(`  64 bytes from ${host}: seq=${i+1} time=${d}ms`, 't-value', i*500));
    printQueue.then(() => {
      const avg = (delays.reduce((a,b)=>a+b,0)/delays.length).toFixed(1);
      printLine(`  \u2014 ${host}: 4 transmitted, 4 received, 0% loss, avg=${avg}ms`, 't-muted');
    });
  }

  function cmdTraceroute(args) {
    const host = args[0] || '10.0.1.1';
    printLine(`TRACEROUTE to ${host}`, 't-system');
    const hops = [
      {hop:1,addr:'10.0.\u2588\u2588.1',ms:1},
      {hop:2,addr:'PROXY-SANDBOX',ms:4},
      {hop:3,addr:'STRATA-RELAY-01',ms:9},
      {hop:4,addr:host,ms:14},
    ];
    hops.forEach((h,i) =>
      printLine(`  ${h.hop}  ${h.addr.padEnd(20)}  ${h.ms}ms`, 't-value', i*400+200));
  }

  function cmdIfconfig() {
    printLine('INTERFACE CONFIGURATION', 't-header');
    printLine('  strata0: flags=4163<UP,BROADCAST,RUNNING,MULTICAST>  mtu 1500', 't-value');
    printLine('    inet 10.0.\u2588\u2588.\u2588\u2588  netmask 255.255.255.0', 't-muted');
    printLine('    TX packets 412  bytes 62144', 't-muted');
    printLine('    RX packets 389  bytes 55312', 't-muted');
  }

  function cmdConnect(args) {
    requireScope('NETTECH', () => {
      const ep = args[0] || 'unspecified';
      printLine(`Connecting to ${ep}\u2026`, 't-system');
      simulateOperation([
        {text:'Routing through proxy sandbox\u2026',delay:300,variance:200},
        {text:'Authenticating endpoint\u2026',delay:400,variance:200},
        {text:'Establishing secure channel\u2026',delay:350,variance:150},
      ]).then(() => printLine('Connection established (read-only).', 't-success'));
    });
  }

  function cmdDisconnect() {
    requireScope('NETTECH', () => {
      printLine('Disconnecting proxy channel\u2026', 't-warn');
      setTimeout(() => printLine('Disconnected.', 't-success'), 600);
    });
  }

  function cmdProxy(args) {
    const sub = args[0]?.toLowerCase();
    if (sub === 'list') {
      printLine('ACTIVE PROXIES', 't-header');
      printLine('  PROXY-DB-01     \u2014 DATABASE (read-only)   ACTIVE', 't-value');
      printLine('  PROXY-ARCH-01   \u2014 ARCHIVE  (read-only)   ACTIVE', 't-value');
      printLine('  PROXY-NET-01    \u2014 EXTERNAL (sandboxed)   STANDBY', 't-value');
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
        printLine('  ALLOW   10.0.0.0/8    \u2192 INTERNAL', 't-success');
        printLine('  ALLOW   PROXY-SANDBOX \u2192 OUTBOUND', 't-success');
        printLine('  DENY    ALL           \u2192 DIRECT-EXTERNAL', 't-error');
        printLine('  LOG     ALL           \u2192 AUDIT', 't-muted');
      } else {
        printLine('Firewall: ACTIVE \u2014 3 rules loaded', 't-success');
      }
    });
  }

  // ── Access & auth commands ────────────────────────────────────────────────

  function cmdAccess(args) {
    requireAuth(() => {
      const scope = args[1] || args[0];
      if (!scope) { printLine('Usage: access check [scope]', 't-muted'); return; }
      const has = Auth.hasScope(scope.toUpperCase());
      printLine(`Scope '${scope.toUpperCase()}': ${has ? 'AUTHORISED' : 'DENIED'}`, has ? 't-success' : 't-error');
    });
  }

  function cmdAuth(args) {
    requireAuth(() => {
      const sub = args[0]?.toLowerCase();
      if (sub === 'refresh') {
        printLine('Refreshing session token\u2026', 't-system');
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
      printLine(`Clearance Level ${u.clearance} \u2014 ${Auth.CL_LABELS[u.clearance]}`, 't-value');
    });
  }

  function cmdScope() {
    requireAuth(() => {
      const u = Auth.getUser();
      printLine('Active scopes:', 't-muted');
      u.scopes.forEach(s => printLine(`  \u2713 ${s}`, 't-success'));
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
      printLine('PERMISSIONS SUMMARY', 't-header'); printDivider();
      printLine(`  Clearance               : ${u.clearance} \u2014 ${Auth.CL_LABELS[u.clearance]}`, 't-value');
      printLine(`  Scopes                  : ${u.scopes.join(', ')}`, 't-value');
      printLine(`  Database read           : ALL (via proxy)`, 't-value');
      const canWrite = Auth.hasScope('ARCHIVE') || Auth.hasScope('NETTECH');
      printLine(`  Database write          : ${canWrite ? 'AUTHORISED (scoped)' : 'DENIED'}`, canWrite ? 't-success' : 't-error');
      printLine(`  External access         : READ-ONLY (Strata-3 proxy)`, 't-value');
      printLine(`  IT system access        : ${Auth.hasScope('NETTECH') ? 'AUTHORISED' : 'DENIED'}`, Auth.hasScope('NETTECH') ? 't-success' : 't-error');
      printLine(`  Site-wide broadcast     : ${Auth.hasScope('SITEAUTHORITY') ? 'AUTHORISED' : 'DENIED'}`, Auth.hasScope('SITEAUTHORITY') ? 't-success' : 't-error');
      printLine(`  Lockdown authority      : ${Auth.hasClearance(4) ? 'AUTHORISED' : 'DENIED'}`, Auth.hasClearance(4) ? 't-success' : 't-error');
      printLine(`  Desktop environment     : ${Auth.hasClearance(1) ? 'AUTHORISED' : 'DENIED'}`, Auth.hasClearance(1) ? 't-success' : 't-error');
    });
  }

  function cmdScan(args) {
    const target = args[0] || 'local';
    printLine(`Security scan: ${target}`, 't-system');
    simulateOperation([
      {text:'Enumerating attack surface\u2026',delay:350,variance:200},
      {text:'Checking for anomalous process signatures\u2026',delay:400,variance:200},
      {text:'Validating layer boundaries\u2026',delay:300,variance:150},
      {text:'Testing proxy isolation\u2026',delay:350,variance:150},
    ]).then(() => {
      printBlank();
      if (Auth.hasScope('SECURITY')) {
        printLine('SCAN COMPLETE \u2014 No threats detected.', 't-success');
        printLine('  All layers nominal. Proxy intact. Audit log clean.', 't-muted');
      } else {
        printLine('SCAN COMPLETE \u2014 Basic check only (SECURITY scope required for full report).', 't-warn');
      }
    });
  }

  function cmdLock() {
    requireAuth(() => {
      printLine('Terminal locked. Authentication required to resume.', 't-warn');
      locked = true;
      printQueue.then(() => {
        const users = StrataOS.getUsers();
        Auth.showCardModal(users, user => onLoginComplete(user));
      });
    });
  }

  // ── Database commands ─────────────────────────────────────────────────────

  function cmdDb(args) {
    const sub = args[0]?.toLowerCase() || 'status';
    if (sub === 'list') {
      printLine('AVAILABLE DATABASES (read-only via proxy)', 't-header');
      printLine('  PERSONNEL-DB    \u2014 Personnel records (clearance 1+)', 't-value');
      printLine('  ARCHIVE-DB      \u2014 Document archive (clearance 2+)', 't-value');
      printLine('  ANOMALY-INDEX   \u2014 Anomaly catalogue (clearance 2+)', 't-value');
      printLine('  SITE-SYSTEMS    \u2014 Site infrastructure (NETTECH scope)', 't-value');
      printLine('  CLASSIFIED-DB   \u2014 Classified records (clearance 4+)', 't-value');
    } else {
      printLine('Database proxy: ACTIVE', 't-success');
      printLine('Access mode: READ-ONLY (proxy-enforced)', 't-muted');
    }
  }

  function cmdQuery(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: query [database] [term]', 't-muted'); return; }
      const db = args[0].toUpperCase(), term = args.slice(1).join(' ');
      if (db === 'CLASSIFIED-DB' && !Auth.hasClearance(4)) { printLine('[ ACCESS DENIED \u2014 clearance 4 required ]', 't-error'); return; }
      if (db === 'SITE-SYSTEMS' && !Auth.hasScope('NETTECH')) { printLine('[ ACCESS DENIED \u2014 NETTECH scope required ]', 't-error'); return; }
      printLine(`Querying ${db} for "${term}"\u2026`, 't-system');
      simulateOperation([
        {text:'Routing query through proxy\u2026',delay:300,variance:200},
        {text:'Validating query format\u2026',delay:200,variance:100},
        {text:'Awaiting database response\u2026',delay:400,variance:300},
        {text:'Sanitising results\u2026',delay:250,variance:100},
      ]).then(() => {
        printBlank();
        printLine(`Results for "${term}" in ${db}:`, 't-value');
        printLine(`  [0001]  ${term.toUpperCase()} \u2014 record found (access permitted)`, 't-muted');
        printLine(`  [0002]  Related records: \u2588\u2588\u2588\u2588\u2588\u2588 (REDACTED)`, 't-muted');
      });
    });
  }

  function cmdArchiveCmd(args) {
    requireClearance(2, () => {
      const sub = args[0]?.toLowerCase() || 'list';
      if (sub === 'list') {
        printLine('ARCHIVE DATABASE \u2014 RECENT DOCUMENTS', 't-header');
        printLine('  DOC-001   Containment Protocol Review 2024', 't-value');
        printLine('  DOC-002   Site Inspection Report Q3', 't-value');
        printLine('  DOC-003   Personnel Roster (RESTRICTED)', 't-value');
        printLine('  DOC-004   \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588 (REDACTED)', 't-muted');
      } else {
        printLine('Open documents via the Archive Writer application (startx).', 't-muted');
      }
    });
  }

  function cmdWrite(args) {
    requireAuth(() => {
      const canWrite = Auth.hasScope('ARCHIVE') || Auth.hasScope('NETTECH');
      if (!canWrite) { printLine('[ ACCESS DENIED \u2014 write scope not in authorisation ]', 't-error'); return; }
      if (args.length < 2) { printLine('Usage: write [database] [data]', 't-muted'); return; }
      const db = args[0].toUpperCase(), data = args.slice(1).join(' ');
      printLine(`Requesting write authorisation to ${db}\u2026`, 't-system');
      simulateOperation([
        {text:'Validating write scope\u2026',delay:300,variance:150},
        {text:'Submitting write request to Strata-4\u2026',delay:400,variance:200},
        {text:'Awaiting authorisation gate\u2026',delay:500,variance:300},
        {text:'Logging write operation to audit trail\u2026',delay:200,variance:100},
      ]).then(() => printLine(`Write to ${db} AUTHORISED \u2014 data committed.`, 't-success'));
    });
  }

  function cmdExport(args) {
    requireClearance(2, () => {
      printLine('Export function restricted to Archive Writer application.', 't-muted');
      printLine('Launch via startx \u2192 Archive Writer.', 't-muted');
    });
  }

  // ── Comms commands ────────────────────────────────────────────────────────

  function cmdAlert(args) {
    requireScope('SECURITY', () => {
      const level = args[0] || '1', msg = args.slice(1).join(' ') || 'unspecified';
      printLine(`ALERT LEVEL ${level} \u2014 ${msg.toUpperCase()}`, 't-error');
      StrataOS.showToast(`ALERT LVL ${level}: ${msg}`, 'error');
    });
  }

  function cmdBroadcast(args) {
    requireScope('SITEAUTHORITY', () => {
      const msg = args.join(' ') || '(empty)';
      printLine('Broadcasting to all terminals\u2026', 't-system');
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
      printLine(`Routing message to ${uid}\u2026`, 't-system');
      setTimeout(() => printLine(`Message delivered to ${uid}.`, 't-success'), 800);
    });
  }

  function cmdNotify(args) {
    requireAuth(() => {
      if (args.length < 2) { printLine('Usage: notify [uid] [text]', 't-muted'); return; }
      const uid = args[0], text = args.slice(1).join(' ');
      setTimeout(() => {
        printLine(`Notification sent to ${uid}.`, 't-success');
        StrataOS.showToast(`NOTIFY \u2192 ${uid}: ${text}`, 'success');
      }, 600);
    });
  }

  // ── Crypto commands ───────────────────────────────────────────────────────

  function simpleHash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16).toUpperCase().padStart(8,'0');
  }

  function cmdEncrypt(args) {
    requireClearance(1, () => {
      const text = args.join(' ');
      if (!text) { printLine('Usage: encrypt [text]', 't-muted'); return; }
      const fake = btoa(text).replace(/=/g,'').toUpperCase().substring(0,32) + simpleHash(text);
      printLine('Encrypting via STRATA cipher (simulated)\u2026', 't-system');
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
    printLine(`FNV-32: ${simpleHash(text)}`, 't-value');
  }

  function cmdChecksum(args) {
    requireAuth(() => {
      const file = args[0];
      if (!file) { printLine('Usage: checksum [file]', 't-muted'); return; }
      printLine(`Checksum for ${file}: ${simpleHash(file + Date.now())}  [SHA-256 simulated]`, 't-value');
    });
  }

  function cmdKill(args) {
    requireClearance(3, () => {
      const pid = args[0];
      if (!pid) { printLine('Usage: kill [pid]', 't-muted'); return; }
      const safe = ['0001','0002','0003'];
      if (safe.includes(pid)) { printLine(`[ Cannot terminate protected process ${pid} ]`, 't-error'); return; }
      printLine(`Terminating process ${pid}\u2026`, 't-warn');
      setTimeout(() => printLine(`Process ${pid} terminated.`, 't-success'), 500);
    });
  }

  function cmdStress() {
    requireClearance(3, () => {
      printLine('Stress test initiated (simulated)\u2026', 't-warn');
      printProgress('CPU stress\u2026', 2000, 20).then(() =>
        printLine('Stress test complete \u2014 no anomalies.', 't-success'));
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
    setInput(el)  { inputEl  = el; },
    setPrompt(el) { promptEl = el; },
    updatePrompt,
    lockInput()   { locked = true; },
    unlockInput() { locked = false; },
    setPendingCardLogin(v) { pendingCardLogin = v; },
    handleKeyNav(e) {
      if (!inputEl) return;
      if (e.key === 'ArrowUp') {
        if (historyIndex < history.length - 1) {
          historyIndex++;
          inputEl.value = history[history.length - 1 - historyIndex] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (historyIndex > 0) {
          historyIndex--;
          inputEl.value = history[history.length - 1 - historyIndex] || '';
        } else { historyIndex = -1; inputEl.value = ''; }
      } else if (e.key === 'Tab') {
        autocomplete();
      }
    },
    parseCommand,
    getTheme()    { return theme; }
  };

})();