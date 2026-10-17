# Billie - Local Financial Helper

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

**Billie** is an open-source, local-first tool that extracts transaction data from Brazilian credit-card statement PDFs and bank statement CSVs. Track categorized income and expenses right in the app — all without your data ever leaving your machine.

## 🛡️ Privacy First

Financial data is highly sensitive, and Billie was built from day one to respect your privacy:

* **100% Local:** Billie runs entirely on your machine. There are no backend servers, no accounts, and no network calls involved in processing your statement.
* **No Third Parties:** Your PDF/CSV never leaves your computer. Nothing is uploaded, synced, or sent anywhere.

---

## ✨ Features

* **📄 PDF Parsing:** Extracts transaction data from credit card bills (currently supports Nubank, XP/Rico, and Santander).
* **📥 CSV Import:** Imports bank statements from CSV, with automatic delimiter detection and column mapping for non-standard spreadsheets.
* **🔒 Password-Protected PDFs:** Handles encrypted statement PDFs natively (via `pdfjs-dist`, no external tools needed).
* **📊 CSV Export:** Outputs a clean, semicolon-delimited CSV (date, description, amount) formatted for Brazilian locale conventions (Excel-friendly).
* **💰 Controle de Gastos:** Categorizes transactions and manual entries into income/expenses, with automatic category classification and a period-over-period breakdown.
* **🌗 Light/Dark Theme:** Toggle between themes from the header, with a smooth transition.
* **🔄 Smart Updater:** Built-in background checker that notifies you whenever a new release is available on GitHub.
* **💻 Minimal Interface:** A three-tab interface — *Processar Fatura* to parse a PDF bill, *Lançamentos* to import a CSV statement or add entries manually, and *Controle* to see the categorized income/expense breakdown — all in one app, no spreadsheets required.

---

## 🛠️ How to Run (For Developers)

Billie is an npm workspace with two packages — `backend-parser` (parsing engine, `@billie/parser`) and `frontend` (the UI) — plus a `src-tauri/` project that wraps them into a native desktop app.

**1. Clone the repository:**
```bash
git clone https://github.com/eduardoteranisi/billie-project.git
cd billie-project
```

**2. Install dependencies (from the repo root):**
```bash
npm install
```

**3. Run in the browser (fastest for parser/UI iteration):**
```bash
cd frontend
npm run dev
```
Open the URL Vite prints in your browser.

**3b. Or run as a desktop app (Tauri):**
```bash
npm run tauri dev
```
This opens Billie in a native window instead of a browser tab.

---

## 🧪 Testing

**Unit tests and typecheck** — run before every commit (CI also runs both on every pull request to `main`):
```bash
npm run typecheck
npm test
```
Unit tests only use synthetic, inline fixtures — never real statements.

**Snapshot tests over your real statements (`test:local`)** — catch regressions in the parsing results using your own PDFs/CSVs. They run only on your machine, never in CI, and nothing they read or write is committed.

1. Put your statement files in `backend-parser/test-data/`.
2. Create `backend-parser/test-data/local_statement_list.json` from `frontend/tests/local/local_statement_list.example.json`. Every entry needs `file` and `referenceDate` (`yyyy-mm-dd`, the date the file is "imported" — the test freezes the clock on it, since the parser derives years from today's date). PDFs also need `bank` and `year` (plus `password` if the PDF is protected); CSVs take optional `bank` and `columns`.
3. Run:
   ```bash
   npm run test:local
   ```

Each file goes through the full pipeline, and the expenses/income (with the default category rules), the possible-duplicate groups and the per-month DRE are compared against a saved snapshot in `frontend/tests/local/__snapshots__/`:

- **Same result** → passes.
- **Different result** → fails and shows the diff.
- **File with no snapshot yet** → the snapshot is written and the test passes. Check it, since it becomes the reference.

When a change in the result is intentional (e.g. you fixed a parser bug and checked the diff), accept it as the new reference with:
```bash
npm run test:local -- -u
```
Never run `-u` without reading the diff first — otherwise a regression silently becomes the new reference.

Run `test:local` when a change can affect the parsing results: extractors and the rest of `backend-parser/`, the category classifier, `dre_aggregator.ts` or `duplicate_detection.ts`. UI-only changes don't show up in it.

**Checking a branch for regressions:** snapshots are gitignored, so they stay put when you switch branches.
1. On `main`, run `npm run test:local` to generate (or refresh) the reference snapshots. Add new statement files here first.
2. Switch to the feature branch and run `npm run test:local` again — any failure means the feature changed the result for a real statement.
3. After an intentional result change is merged, run `npm run test:local -- -u` on `main` so the reference keeps up.

---

## 📦 Releasing new versions (installers for Windows/Linux)

Installers are **not** built or committed manually — they're produced by CI and attached to a GitHub Release.

1. Bump `version` in `src-tauri/tauri.conf.json` (the only place the app version lives — the in-app updater compares against it).
2. Tag the commit and push the tag:
   ```bash
   git tag v0.1.0
   git push --tags
   ```
3. Pushing a `v*` tag triggers `.github/workflows/release.yml`, which builds Billie on both `windows-latest` and `ubuntu-latest` runners and uploads the installers (`.msi`/`.nsis` for Windows, `.deb`/`.AppImage` for Linux) as assets on a **draft** GitHub Release matching the tag. Each installer is signed with the updater key (`TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, stored as secrets of the `release` GitHub environment, which only accepts `v*` tags), and a `latest.json` manifest is attached for the in-app updater.
4. Go to the repo's [Releases page](https://github.com/eduardoteranisi/billie-project/releases), review the draft, edit the notes if needed, and click **Publish release**. Only then do testers see it — the in-app updater reads `releases/latest/download/latest.json`, which only resolves published releases, so installed apps offer the update on their next launch (Windows and AppImage install silently; `.deb` asks for the admin password via `pkexec`). Installs older than the first updater-enabled version still have to download the new installer manually.
5. Testers download the installer for their OS directly from that Releases page — no site, no account, no upload.

---

## 📝 Naming Conventions

To keep the codebase consistent, follow these conventions when adding folders, files, functions, variables, or constants:

* **Folders** → all lowercase, words separated only by `-` (e.g. `backend-parser`)
* **Files** → all lowercase, snake_case (e.g. `pdf_reader.ts`)
* **Functions** → all lowercase, camelCase (e.g. `runPipeline`)
* **Variables** → all lowercase, camelCase (e.g. `pdfBytes`)
* **Constants** → SCREAMING_CASE (e.g. `RELEASES_PAGE_URL`)

---

## 🤝 Contributing
Pull requests are welcome! If you want to add support for a new bank's PDF format, feel free to open an issue or submit a PR. Please follow the [naming conventions](#-naming-conventions) above.

## 📄 License
The source code is licensed under the MIT License - see the LICENSE file for details.

The logo and icon files (`frontend/public/brand/`, `src-tauri/icons/`) are MIT-licensed too, but the Billie name and logo are trademarks: the MIT License does not grant the right to use them to identify another product. Forks are welcome, but a modified version must ship under its own name and logo - see [TRADEMARKS.md](TRADEMARKS.md).

Developed by [Eduardo Teranisi](https://github.com/eduardoteranisi).
