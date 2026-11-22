# ENPLY desktop (Windows)

A small Electron window around the live ENPLY site (`https://e0ruv.github.io/enply/`).
The site itself is not bundled, so anything published to GitHub Pages shows up in the
desktop app on the next launch — no rebuild needed.

## Build

The Windows `.exe` is built by GitHub Actions (`.github/workflows/build-exe.yml`,
`windows-latest`). Start it from the Actions tab ("Build Windows EXE" → "Run workflow"),
or push a `v*` tag. The run produces:

- `ENPLY-<version>-win-x64.exe` — portable single executable, runs without installing
- `ENPLY-<version>-win-x64-setup.exe` — NSIS installer with Start Menu / desktop shortcut

Both are attached to the GitHub Release the workflow creates and also kept as the
run's artifact.

## Run locally (any OS)

```bash
cd desktop
npm install
npm start
```

## Changing the address

`main.js` reads the site address from `ENPLY_URL`, falling back to the GitHub Pages
URL above. When a custom domain is connected (e.g. `https://enply.net`), either edit
`APP_URL` in `main.js` and rebuild, or start with `ENPLY_URL=https://enply.net`.
