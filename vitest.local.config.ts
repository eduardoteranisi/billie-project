import { defineConfig } from "vitest/config";
import { PDFJS_LEGACY_ALIAS, TEST_ENV } from "./vitest.config";

// Testes de snapshot sobre os PDFs/CSVs reais de backend-parser/test-data (fora do git).
// Rodam só no checkout principal, via `npm run test:local` — nunca no `npm test` nem no CI.
export default defineConfig({
  resolve: { alias: PDFJS_LEGACY_ALIAS },
  test: {
    name: "local",
    root: "./frontend",
    environment: "node",
    env: TEST_ENV,
    include: ["tests/local/**/*.test.ts"],
    setupFiles: ["tests/local/preload_pdf_worker.ts"],
  },
});
