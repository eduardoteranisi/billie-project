// pdfjs-dist só publica tipos para a raiz do pacote ("pdfjs-dist"), não para o
// caminho "pdfjs-dist/build/pdf.mjs" importado em pdf_text_extractor.ts.
// Ambos apontam para o mesmo arquivo (o "main" do pacote), então reaproveitamos os tipos.
declare module "pdfjs-dist/build/pdf.mjs" {
  export * from "pdfjs-dist";
}
