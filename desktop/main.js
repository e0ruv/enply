'use strict';

/*
 * ENPLY desktop shell
 * -----------------------------------------------------------------------------
 * A slim Electron window around the live ENPLY site. The page is served from
 * https://e0ruv.github.io/enply/ today; when a custom domain (for example
 * enply.net) is connected, only APP_URL below has to change, or the process can
 * be started with ENPLY_URL=https://... without touching the code.
 */

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_URL = process.env.ENPLY_URL || 'https://e0ruv.github.io/enply/';
const APP_ORIGIN = (() => {
  try {
    return new URL(APP_URL).origin;
  } catch {
    return null;
  }
})();

const BG = '#0B0617';
const WINDOW_ICON = path.join(__dirname, 'build', 'icon.png');
const REMEMBER_SIZE = true;

let mainWindow = null;
let loadingError = false;

/* ---------------------------------------------------------------- window state */

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');

function readState() {
  if (!REMEMBER_SIZE) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const width = Number(raw.width);
    const height = Number(raw.height);
    return {
      width: width >= 420 && width <= 8000 ? Math.round(width) : undefined,
      height: height >= 680 && height <= 8000 ? Math.round(height) : undefined,
      maximized: raw.maximized === true
    };
  } catch {
    return {};
  }
}

function saveState(win) {
  if (!REMEMBER_SIZE || !win || win.isDestroyed()) return;
  try {
    if (win.isMinimized() || win.isFullScreen()) return;
    const b = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(
      stateFile(),
      JSON.stringify({ width: b.width, height: b.height, maximized: win.isMaximized() })
    );
  } catch {
    /* a missing window state only means the next start is the default size */
  }
}

/* ------------------------------------------------------------------- navigation */

function isAppUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function openExternally(rawUrl, win) {
  if (/^https?:$/.test(new URL(rawUrl).protocol)) {
    shell.openExternal(rawUrl).catch(() => {});
  }
  if (win && !win.isDestroyed()) win.focus();
}

/* ------------------------------------------------------------------ offline page */

function offlinePage(code, description) {
  const safe = String(description || 'Connection failed').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ENPLY</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:
    radial-gradient(120% 90% at 20% 0%,#2a1650 0%,#150b2c 45%,${BG} 100%);
    color:#efe7ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Malgun Gothic",Roboto,sans-serif}
  .card{width:min(420px,86vw);padding:34px 30px 30px;border-radius:26px;text-align:center;
    background:rgba(28,17,52,.72);border:1px solid rgba(196,181,253,.18);
    box-shadow:0 24px 60px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.08)}
  img{width:96px;height:96px;border-radius:24px;image-rendering:auto}
  h1{margin:18px 0 6px;font-size:21px;letter-spacing:-.02em}
  p{margin:0 0 22px;font-size:13.5px;line-height:1.6;color:#b9aede}
  code{font-size:11.5px;color:#8e80bb}
  a{display:inline-block;padding:12px 24px;border-radius:14px;text-decoration:none;
    font-size:14px;font-weight:650;color:#fff;
    background:linear-gradient(135deg,#a78bfa,#7c3aed);
    box-shadow:0 10px 24px rgba(124,58,237,.4)}
</style></head><body>
  <div class="card">
    <img src="${new URL('icons/icon-192.png', APP_URL).href}" alt="ENPLY">
    <h1>ENPLY에 연결하지 못했어요</h1>
    <p>인터넷 연결을 확인하고 다시 시도해 주세요.<br><code>${safe} (${code})</code></p>
    <a href="${APP_URL}">다시 시도</a>
  </div>
</body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

/* ---------------------------------------------------------------------- window */

function createWindow() {
  const state = readState();

  const win = new BrowserWindow({
    width: state.width || 1240,
    height: state.height || 820,
    minWidth: 420,
    minHeight: 680,
    backgroundColor: BG,
    title: 'ENPLY',
    icon: WINDOW_ICON,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });
  mainWindow = win;

  win.once('ready-to-show', () => {
    if (state.maximized) win.maximize();
    win.show();
  });

  win.on('resize', () => saveState(win));
  win.on('close', () => saveState(win));
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  // keep the app name in the title bar; the page's own title stays inside the page
  win.on('page-title-updated', (event) => event.preventDefault());

  // links that ask for a new window/tab go to the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) return { action: 'allow', overrideBrowserWindowOptions: { backgroundColor: BG, autoHideMenuBar: true } };
    try {
      openExternally(url, win);
    } catch {
      /* not a web URL: nothing sensible to open */
    }
    return { action: 'deny' };
  });

  // a click that would leave the site opens in the default browser instead
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    try {
      openExternally(url, win);
    } catch {
      /* ignore unsupported schemes */
    }
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return; // -3 = the navigation was aborted on purpose
    loadingError = errorCode !== 0;
    win.loadURL(offlinePage(errorCode, errorDescription));
  });

  win.webContents.on('did-finish-load', () => {
    loadingError = false;
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    if (details && details.reason === 'clean-exit') return;
    win.loadURL(APP_URL);
  });

  // a small set of desktop shortcuts, since the menu bar is hidden
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const key = input.key;
    const mod = input.control || input.meta;
    if (key === 'F5' || (mod && key.toLowerCase() === 'r')) {
      event.preventDefault();
      if (loadingError || win.webContents.getURL().startsWith('data:')) {
        win.loadURL(APP_URL);
      } else {
        win.webContents.reloadIgnoringCache();
      }
    } else if (key === 'F12' || (mod && input.shift && key.toLowerCase() === 'i')) {
      event.preventDefault();
      win.webContents.toggleDevTools();
    } else if (key === 'F11') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (mod && (key === '=' || key === '+')) {
      event.preventDefault();
      win.webContents.setZoomLevel(Math.min(3, win.webContents.getZoomLevel() + 0.5));
    } else if (mod && key === '-') {
      event.preventDefault();
      win.webContents.setZoomLevel(Math.max(-2, win.webContents.getZoomLevel() - 0.5));
    } else if (mod && key === '0') {
      event.preventDefault();
      win.webContents.setZoomLevel(0);
    }
  });

  win.loadURL(APP_URL);
  return win;
}

/* ------------------------------------------------------------------------ app */

app.setAppUserModelId('io.github.e0ruv.enply');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
