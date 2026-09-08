import { getDocument, GlobalWorkerOptions, PasswordException } from "pdfjs-dist/build/pdf.mjs";

interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

const Y_TOLERANCE = 2;
const MIN_WORD_GAP = 1;

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
      width: item.width,
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

  return rows.map((row) => joinRowItems(row.sort((a, b) => a.x - b.x)));
}

// Some fonts (e.g. the Santander extrato template) split a single word across many
// text items with near-zero horizontal gaps between letters, so joining every item
// with a fixed space would fragment words like "PIX" into "P I X". Only insert a
// space when the gap between items is wide enough to be a real word/column break.
function joinRowItems(row: PositionedTextItem[]): string {
  let line = "";
  for (let i = 0; i < row.length; i++) {
    const item = row[i];
    if (i === 0) {
      line = item.str;
      continue;
    }
    const previous = row[i - 1];
    const gap = item.x - (previous.x + previous.width);
    line += (gap > MIN_WORD_GAP ? " " : "") + item.str;
  }
  return line;
}
