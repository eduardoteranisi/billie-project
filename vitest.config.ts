import { defineConfig } from "vitest/config";

// As datas são montadas no fuso local e formatadas em UTC (formatIsoDate), então o resultado
// depende do fuso da máquina. Fixa o fuso dos usuários para CI e máquinas locais darem o mesmo resultado.
const TEST_ENV = { TZ: "America/Sao_Paulo" };

// A versão de navegador do pdf.js quebra ao ser importada no Node (DOMMatrix is not defined).
// Qualquer teste que importe algo que chegue em pdf_text_extractor.ts (ex.: @billie/parser, os extratores)
// usa a versão legacy, que é o mesmo código do pdf.js com polyfills para o Node.
const PDFJS_LEGACY_ALIAS = [
  { find: /^pdfjs-dist\/build\/pdf\.mjs$/, replacement: "pdfjs-dist/legacy/build/pdf.mjs" },
];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: PDFJS_LEGACY_ALIAS },
        test: {
          name: "backend-parser",
          root: "./backend-parser",
          environment: "node",
          env: TEST_ENV,
          include: ["tests/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: PDFJS_LEGACY_ALIAS },
        test: {
          name: "frontend",
          root: "./frontend",
          environment: "node",
          env: TEST_ENV,
          include: ["tests/**/*.test.ts"],
        },
      },
    ],
  },
});
