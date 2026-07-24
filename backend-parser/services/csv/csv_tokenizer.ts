export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

const CSV_DELIMITER = ";";

export function parseCsvText(csvText: string): ParsedCsv {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };

  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === CSV_DELIMITER) {
      endField();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    endRow();
  }

  const nonEmptyRows = rows.filter((r) => !(r.length === 1 && r[0] === ""));

  if (nonEmptyRows.length === 0) {
    throw new Error("CSV vazio ou sem cabeçalho.");
  }

  const [headers, ...dataRows] = nonEmptyRows;
  return { headers, rows: dataRows };
}
