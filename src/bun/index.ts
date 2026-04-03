import { BrowserWindow, ApplicationMenu } from "electrobun/bun";

// Enable standard keyboard shortcuts (Copy, Paste, Undo, Redo, etc.)
ApplicationMenu.setApplicationMenu([
  {
    submenu: [{ label: "Quit", role: "quit" }],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "delete" },
      { role: "selectAll" },
    ],
  },
]);

// Determine whether we are explicitly running the packed app 
// For now we assume typical dev mode hits the local Astro server,
// while the production build will hit the bundled views:// folder.

// Note: Electrobun doesn't inject NODE_ENV dynamically out of the box in dev vs prod, 
// so we'll just check if the local dev server is running or fallback safely.
// For simplicity, we can point it directly to the built static bundle or local server.
// As a best practice for Electrobun we aim the url at the copied 'views' schema folder:
const url = "views://main/index.html";

console.log("App code is executing! Creating window...");
const win = new BrowserWindow({
  title: "DuoAnalytics",
  url: url,
  frame: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  }
});
console.log("Window created!");
