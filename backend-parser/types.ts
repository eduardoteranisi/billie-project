export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
}

export interface CsvColumnConfig {
  date: string;
  merchant: string;
  amount: string;
  installment?: string;
}

export interface RawTransaction {
  date: string;
  dirtyDescription: string;
  rawAmount: string;
}

export type Bank = "Nubank" | "XP / Rico" | "Santander";

export type LogFn = (message: string) => void;

export interface PdfParseInput {
  source: "pdf";
  pdfBytes: Uint8Array;
  password?: string;
  bank: Bank;
  year: string;
}

export interface CsvParseInput {
  source: "csv";
  csvText: string;
  columns?: CsvColumnConfig; // mapeamento inverso ao uso em csv_exporter.ts (que nomeia colunas de saída)
}

export type ParseInvoiceInput = PdfParseInput | CsvParseInput;

export type CategoryGroup = "fixed" | "variable";

export interface ExpenseCategory {
  id: string;
  label: string;
  type: "expense";
  group: CategoryGroup;
}

export interface IncomeCategory {
  id: string;
  label: string;
  type: "income";
}

export type Category = ExpenseCategory | IncomeCategory;

export interface CategoryRule {
  categoryId: string;
  keywords: string[];
}

export interface CategorizedTransaction extends Transaction {
  categoryId: string;
}