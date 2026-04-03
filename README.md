# DuoAnalytics

DuoAnalytics is a dual-target analytics application. It features a web-first frontend built with Astro, React, and Tailwind CSS, alongside a native desktop client powered by Electrobun.

## 🚀 Tech Stack

- **Framework**: [Astro](https://astro.build/)
- **UI Components**: [React](https://react.dev/) & [Tailwind CSS](https://tailwindcss.com/)
- **Desktop Runtime**: [Electrobun](https://electrobun.dev/)

## 📂 Project Structure

```text
/
├── artifacts/             # Packaged desktop application builds
├── build/                 # Compiled Electrobun desktop bundles
├── public/                # Static assets mapped to the web root
├── src/
│   ├── bun/               # Electrobun backend/main process code
│   ├── components/        # UI components (React/Astro)
│   ├── desktop/           # Desktop-specific views
│   ├── layouts/           # Astro layouts
│   └── pages/             # Astro file-based routing
├── electrobun.config.ts   # Configuration for the desktop app
├── astro.config.mjs       # Configuration for the web app
└── package.json           # Dependencies and scripts
```

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

### Web (Cloudflare Pages Target)

| Command             | Action                                        |
| :------------------ | :-------------------------------------------- |
| `bun install`     | Installs dependencies                         |
| `bun run dev`     | Starts local web dev server                   |
| `bun run build`   | Builds the production web site to `./dist/` |
| `bun run preview` | Previews the web build locally                |

### Desktop (Electrobun)

| Command                   | Action                                       |
| :------------------------ | :------------------------------------------- |
| `bun run desktop:dev`   | Builds web assets and starts the desktop app |
| `bun run desktop:build` | Packages the desktop application             |

## 🌍 Deployment

The web dashboard is organized to support standard cloud deployments. To deploy the web application to **Cloudflare Pages**, link this repository in your Cloudflare dashboard, set the framework to "Astro", the build command to `bun run build`, and the build output directory to `dist`.

## 👀 Learn More

- [Astro Documentation](https://docs.astro.build)
- [Electrobun Integration Guide](./ELECTROBUN_INTEGRATION_GUIDE.md)
