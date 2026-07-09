import { getDocument, GlobalWorkerOptions, PasswordException } from "pdfjs-dist/build/pdf.mjs";

interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
}

const Y_TOLERANCE = 2;

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const STANDARD_FONT_DATA_URL = "/standard_fonts/";

export async function extractPdfLines(pdfBytes: Uint8Array, password?: string): Promise<string[]> {
  let document;
  try {
    document = await getDocument({
      data: pdfBytes,
      password,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
      isEvalSupported: false,
    }).promise;
  } catch (error) {
    if (error instanceof PasswordException) {
      throw new Error(`Erro ao desbloquear o PDF. A senha está correta? Detalhes: ${error}`);
    }
    throw error;
  }

  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    const items: PositionedTextItem[] = content.items.map((item: any) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
    }));

    lines.push(...groupItemsIntoLines(items));
  }

  return lines;
}

function groupItemsIntoLines(items: PositionedTextItem[]): string[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedTextItem[][] = [];

  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0].y - item.y) <= Y_TOLERANCE);
    if (row) row.push(item);
    else rows.push([item]);
  }

  return rows.map((row) =>
    row.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ")
  );
}