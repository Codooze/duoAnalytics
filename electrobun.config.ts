import type { ElectrobunConfig } from "electrobun";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const packageJson = JSON.parse(readFileSync("./package.json", "utf8"));

// Read all built Astro files dynamically to copy them individually if copy doesn't support directories
function getFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  if (!require("fs").existsSync(dir)) return [];
  const list = readdirSync(dir);
  for (const file of list) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getFilesRecursive(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

const copyFiles: Record<string, string> = {};
const distFiles = getFilesRecursive("dist");
for (const file of distFiles) {
  // e.g. file is "dist/_astro/bundle.js" -> "views/main/_astro/bundle.js"
  const normalizedFile = file.replace(/\\/g, "/");
  const relativePath = normalizedFile.replace("dist/", "");
  copyFiles[normalizedFile] = `views/main/${relativePath}`; // Mapped to views/main
}

export default {
  app: {
    name: "DuoAnalytics",
    identifier: "com.jeison.duoanalytics",
    version: packageJson.version,
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  build: {
    copy: copyFiles,
    mac: {
      bundleCEF: false, 
      defaultRenderer: "native"
    },
    win: {
      bundleCEF: false,
      defaultRenderer: "native",
      icon: "public/icon_256x256.png"
    },
    linux: {
      bundleCEF: false,
      defaultRenderer: "native",
      icon: "public/favicon.ico"
    }
  },
} satisfies ElectrobunConfig;