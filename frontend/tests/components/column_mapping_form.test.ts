import { describe, expect, it } from "vitest";
import {
  fillColumnMappingSelects,
  readColumnMappingSelects,
  type ColumnMappingSelects,
} from "../../components/column_mapping_form";

function buildSelects(values: Partial<Record<keyof ColumnMappingSelects, string>> = {}): ColumnMappingSelects {
  const buildSelect = (value = "") => ({ innerHTML: "", value }) as HTMLSelectElement;
  return {
    date: buildSelect(values.date),
    description: buildSelect(values.description),
    amount: buildSelect(values.amount),
    installment: buildSelect(values.installment),
  };
}

describe("fillColumnMappingSelects", () => {
  it("preenche as selects com os cabeçalhos escapados e deixa a parcela opcional", () => {
    const selects = buildSelects();

    fillColumnMappingSelects(selects, ["Data", "<Valor>"]);

    const expectedOptions = `<option value="Data">Data</option><option value="&lt;Valor&gt;">&lt;Valor&gt;</option>`;
    expect(selects.date.innerHTML).toBe(expectedOptions);
    expect(selects.description.innerHTML).toBe(expectedOptions);
    expect(selects.amount.innerHTML).toBe(expectedOptions);
    expect(selects.installment.innerHTML).toBe(`<option value="">— nenhuma —</option>${expectedOptions}`);
  });
});

describe("readColumnMappingSelects", () => {
  it("monta a configuração de colunas a partir das selects", () => {
    const selects = buildSelects({ date: "Data", description: "Loja", amount: "Valor", installment: "Parcela" });

    expect(readColumnMappingSelects(selects)).toEqual({
      date: "Data",
      description: "Loja",
      amount: "Valor",
      installment: "Parcela",
    });
  });

  it("deixa a parcela indefinida quando nenhuma coluna foi escolhida", () => {
    const selects = buildSelects({ date: "Data", description: "Loja", amount: "Valor", installment: "" });

    expect(readColumnMappingSelects(selects).installment).toBeUndefined();
  });
});
