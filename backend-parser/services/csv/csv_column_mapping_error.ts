import type { CsvColumnRole } from "./csv_column_resolver";

export class CsvColumnMappingError extends Error {
  readonly headers: string[];
  readonly missingRoles: CsvColumnRole[];

  constructor(headers: string[], missingRoles: CsvColumnRole[]) {
    super("Não foi possível identificar automaticamente as colunas do CSV.");
    this.name = "CsvColumnMappingError";
    this.headers = headers;
    this.missingRoles = missingRoles;
  }
}
