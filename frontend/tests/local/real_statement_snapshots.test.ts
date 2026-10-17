import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyTransactionList,
  DEFAULT_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INCOME_CATEGORY_RULES,
  runPipeline,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
  type RunPipelineOptions,
} from "@billie/parser";
import { calculateDre, listAvailablePeriods } from "../../services/dre_aggregator";
import { groupPossibleDuplicateRows } from "../../services/duplicate_detection";
import type { StoredExpense, StoredIncome } from "../../types";
import {
  readLocalStatementList,
  readStatementCsvText,
  readStatementPdfBytes,
  type LocalStatement,
} from "./local_statement_list";

const ALL_DEFAULT_CATEGORIES = [...DEFAULT_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];

// laço em vez de describe.each: o título formatado por ele corta nomes longos, e dois arquivos
// que só diferem no fim do nome (ex.: o mesmo extrato em PDF e CSV) ficariam com a mesma chave de snapshot.
for (const statement of readLocalStatementList()) {
  describeStatementSnapshot(statement);
}

function describeStatementSnapshot(statement: LocalStatement) {
  describe(statement.file, () => {
    beforeEach(() => {
      // só o Date é congelado: o pdf.js depende dos timers reais para ler o PDF.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(`${statement.referenceDate}T12:00:00`));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("mantém o resultado já conferido", async () => {
      expect(await buildStatementSnapshot(statement)).toMatchSnapshot();
    });
  });
}

async function buildStatementSnapshot(statement: LocalStatement) {
  const result = await runPipeline(buildPipelineOptions(statement));

  // é o que o app mostraria como pedido de mapeamento manual de colunas.
  if (result.needsColumnMapping) return { needsColumnMapping: result.needsColumnMapping };
  if (!result.success || !result.transactions) {
    throw new Error(`${statement.file}: ${result.error ?? "erro desconhecido no processamento"}`);
  }

  // regras padrão de categoria, como classifyAndSaveExpenseList/classifyAndSaveIncomeList num app sem personalização.
  const expenses: StoredExpense[] = classifyTransactionList(result.transactions).map((transaction) => ({
    ...transaction,
    origin: statement.kind,
  }));
  const income: StoredIncome[] = classifyTransactionList(
    result.income ?? [],
    DEFAULT_INCOME_CATEGORY_RULES,
    UNCATEGORIZED_INCOME_CATEGORY_ID
  );

  return {
    expenses,
    income,
    possibleDuplicateExpenseGroups: groupPossibleDuplicateRows(expenses).map(summarizeDuplicateGroup),
    possibleDuplicateIncomeGroups: groupPossibleDuplicateRows(income).map(summarizeDuplicateGroup),
    dreByPeriod: listAvailablePeriods(expenses, income).map((period) =>
      calculateDre(period, expenses, income, ALL_DEFAULT_CATEGORIES)
    ),
  };
}

function buildPipelineOptions(statement: LocalStatement): RunPipelineOptions {
  const onLog = () => {};
  if (statement.kind === "pdf") {
    return {
      source: "pdf",
      pdfBytes: readStatementPdfBytes(statement),
      password: statement.password,
      bank: statement.bank,
      year: statement.year,
      onLog,
    };
  }
  return {
    source: "csv",
    csvText: readStatementCsvText(statement),
    columns: statement.columns,
    bank: statement.bank,
    onLog,
  };
}

function summarizeDuplicateGroup(group: { date: string; amount: number; description: string }[]) {
  return {
    date: group[0].date,
    amount: group[0].amount,
    descriptions: group.map((row) => row.description),
  };
}
