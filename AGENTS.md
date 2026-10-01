# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

Keep every custom select control and its dropdown arrow on the same horizontal line. The Ant Design icon wrapper (`.anticon`) must be positioned inside `.select-wrap` rather than flowing after the native `<select>`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

The frontline App prototype lives in `app.html` and `src/app/`. Its components and visuals should stay as close as possible to the Yonyou BIP mobile platform: use antd-mobile (the base of BIP's TinperM / yonui-mobile) themed with BIP tokens, primary red `#E60012`, grey canvas, white cards, label-left / value-right form rows and a red primary bottom action bar. Keep every BIP mobile token in `src/app/app.css`. No official BIP mobile screenshots exist yet, so the current tokens are inferred; when screenshots arrive, compare screen by screen and replace the tokens there.

On desktop, `app.html` frames the App in a same-origin iframe (`app.html?embed=1`) so antd-mobile popups, toasts and fixed bars stay inside the phone. The demo control panel talks to the App through `postMessage`. The App shares the back-office demo data in `localStorage` (`iam-demo-state-v1`) and keeps App-only state in `is-app-demo-v1`.
