# Pro Chess

A modern two-player chess web application with Three Check rule support, local gameplay, timers, move history, and captured pieces tracking.

## Features

- Local two-player chess match
- Three Check win condition
- Move history panel
- Captured pieces tracking
- Undo and restart controls
- Responsive board layout with rank/file coordinates

## Project Structure

- `index.html`, `style.css`, `script.js`: Main web app source
- `www/`: Synced web assets used by Capacitor
- `android/`: Capacitor Android project

## Run In Browser

Because some Windows PowerShell setups block npm/npx scripts, use the command shim:

```powershell
npx.cmd --yes http-server . -p 5173
```

Then open:

- http://127.0.0.1:5173

## Run Android (Capacitor)

```powershell
npx.cmd cap run android
```

## Install Dependencies

```powershell
npm.cmd install
```

## Notes

- If you update web files (`index.html`, `style.css`, `script.js`), keep `www/` files in sync for Capacitor builds.
- This repository is configured to ignore build outputs and dependencies with `.gitignore`.
