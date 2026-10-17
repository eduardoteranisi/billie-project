// O worker do pdf.js não publica tipos; só é importado em preload_pdf_worker.ts.
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";

// Onde o pdf.js procura um worker já carregado antes de tentar o workerSrc.
declare var pdfjsWorker: unknown;
