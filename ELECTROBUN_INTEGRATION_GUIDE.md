# Electrobun Integration Guide & Common Pitfalls

This guide documents the implementation of Electrobun in an existing web project (like Astro, React, or Vite), detailing the architecture, common errors, and best practices to ensure a smooth developer experience for humans and AI agents alike.

## 1. Project Structure and Architecture Overview

Electrobun runs a lightweight, fast webview bound to a native backend powered by Bun and Zig. A typical integration looks like this:

- **Frontend Code**: Your regular web framework (Astro, Vite, React, etc.) outputs static files into a `dist` or `build` folder.
- **Backend Code**: The main Electron-like process written for Bun, usually living in `src/bun/index.ts` (or `src/main.ts`).
- **Configuration** (`electrobun.config.ts`): Tells Electrobun where your entrypoint is, and how to map your frontend static files to the custom `views://` protocol scheme.

---

## 2. Common Mistakes & Pitfalls

### A. The "Black Screen" Issue (`views://` Protocol Bug)
**Symptom**: The Electrobun window opens, but it is completely black. The console says something like: `Could not open views file: .../views/index.html/`
**Cause**: When passing a URL to Electrobun's `BrowserWindow`, the custom scheme requires a dummy hostname. If you provide `views://index.html`, the browser engine interprets `index.html` as the **domain/host** (equivalent to `google.com`) and automatically appends a trailing slash, requesting the file `index.html/` as a directory.
**Solution**: Provide a fake domain (like `main`) in the URL, and adjust the copy mechanism in `electrobun.config.ts`.
- **Wrong**: `url: "views://index.html"`
- **Correct**: `url: "views://main/index.html"`
- **Config Adjustment**: Ensure files map to `views/main/index.html` not `views/index.html`.

### B. `EACCES: permission denied` Error on Rebuilds (Windows specifically)
**Symptom**: When trying to run `desktop:build` or `desktop:dev`, a crash occurs with a permission denied error trying to `rm build/dev-win-x64...`.
**Cause**: The previously launched instance of the app (`launcher.exe`, `bun.exe`) crashed or hung in the background and is still holding a file lock on the built binaries.
**Solution**: Kill any lingering processes before rebuilding. From PowerShell:
```powershell
Get-Process | Where-Object Name -match "(launcher|bun|DuoAnalytics)" | Stop-Process -Force
```

### C. Node Version Compatibility inside Bun
**Symptom**: Underlying frontend frameworks (e.g., Astro) fail to build, stating "Node.js v22.6.0 is not supported... Please upgrade Node.js".
**Cause**: Older versions of Bun (e.g., v1.2.2) internally report Node `v22.6.0` through `process.versions.node`, which trips up strict version checks on newly updated dependencies.
**Solution**: Simply upgrade Bun to the latest version.
```powershell
bun upgrade
```

### D. Executing the Production Build (Where is the `.exe`?)
**Symptom**: After running `desktop:build`, you find files like `DuoAnalytics.tar.zst` and you don't know how to run the app.
**Cause**: The `.tar.zst` files in the `artifacts/` folder are OTA (Over-The-Air) update archives, not Windows Setup installers.
**Solution**:
To natively run the raw desktop app without an installer, navigate to the extracted bundle:
`build/stable-win-x64/<AppName>/bin/`
Here, you'll find a `launcher` file. Sometimes it misses the `.exe` extension on Windows builds. Rename `launcher` to `launcher.exe` and double-click to run. (Note: Newer versions of Electrobun configure this automatically).

---

## 3. Recommended Minimal Configuration Example

**`electrobun.config.ts`**:
```typescript
import type { ElectrobunConfig } from "electrobun";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));

// Using a custom recursive function if standard copy doesn't support recursive dirs
// Maps everything from 'dist' into 'views/main' to allow proper url parsing
function getFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  if (!require("fs").existsSync(dir)) return [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      results = results.concat(getFilesRecursive(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

const copyFiles: Record<string, string> = {};
for (const file of getFilesRecursive("dist")) {
  const normalizedFile = file.replace(/\\/g, "/");
  const relativePath = normalizedFile.replace("dist/", "");
  copyFiles[normalizedFile] = `views/main/${relativePath}`; // Maps dist to views/main/...
}

export default {
  app: {
    name: "MyAppName",
    identifier: "com.mycompany.app",
    version: packageJson.version,
  },
  build: {
    bun: {
      entrypoint: "src/bun/index.ts", // Your main process entry point
    },
    copy: copyFiles,
    mac: { bundleCEF: false, defaultRenderer: "native" },
    win: { bundleCEF: false, defaultRenderer: "native" },
    linux: { bundleCEF: false, defaultRenderer: "native" }
  },
} satisfies ElectrobunConfig;
```

**`src/bun/index.ts`** (Main Process):
```typescript
import { BrowserWindow } from "electrobun/bun";

// Important: the domain name 'main' must match the folder created in config.copy
const url = "views://main/index.html";

const win = new BrowserWindow({
  title: "My Electrobun App",
  url: url,
  frame: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  }
});
```

## 4. Work Flow Checklist (For AI and Human Readers)

1. Build your framework to output static files (`npm run build` -> `dist/`).
2. Wipe the `build/dev-win-x64` directory if encountering permission bugs in Dev mode.
3. Call `electrobun dev` or `electrobun build`.
4. Ensure `views/domain_name/file.html` parity inside config mapper.
5. If experiencing a bug where the window just flashes briefly and crashes, ALWAYS run from a terminal to see `stdout` logs. Double-clicking the `.exe` will hide `process.exit(1)` errors.