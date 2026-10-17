// O workerSrc de pdf_text_extractor.ts é montado com `new URL(..., import.meta.url)`, que só resolve
// dentro do build do Vite. No Node, o pdf.js usa o worker que já estiver carregado em globalThis.
globalThis.pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");

export {};
