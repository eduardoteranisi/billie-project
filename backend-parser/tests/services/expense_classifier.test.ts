import { describe, expect, it } from "vitest";
import {
  classifyTransactionDescription,
  classifyTransactionList,
  DEFAULT_INCOME_CATEGORY_RULES,
  UNCATEGORIZED_CATEGORY_ID,
  UNCATEGORIZED_INCOME_CATEGORY_ID,
} from "../../services/expense_classifier";

describe("classifyTransactionDescription", () => {
  it("classifica pela palavra-chave, ignorando acentos e maiúsculas", () => {
    expect(classifyTransactionDescription("Drogaria São Paulo")).toBe("health");
    expect(classifyTransactionDescription("pão de açúcar")).toBe("food");
  });

  it("usa a primeira regra que bate, na ordem da lista", () => {
    // "AMAZON PRIME" (assinaturas) vem antes de "AMAZON" (compras)
    expect(classifyTransactionDescription("AMAZON PRIME VIDEO")).toBe("subscriptions");
    expect(classifyTransactionDescription("AMAZON MARKETPLACE")).toBe("shopping");
  });

  it("cai na categoria padrão quando nenhuma regra bate", () => {
    expect(classifyTransactionDescription("Loja desconhecida")).toBe(UNCATEGORIZED_CATEGORY_ID);
  });

  it("aceita regras e categoria padrão personalizadas", () => {
    const rules = [{ categoryId: "pets", keywords: ["petshop"] }];

    expect(classifyTransactionDescription("PETSHOP DO BAIRRO", rules, "misc")).toBe("pets");
    expect(classifyTransactionDescription("Padaria", rules, "misc")).toBe("misc");
  });

  it("classifica receitas com as regras e a categoria padrão de receita", () => {
    expect(
      classifyTransactionDescription("Salário empresa", DEFAULT_INCOME_CATEGORY_RULES, UNCATEGORIZED_INCOME_CATEGORY_ID)
    ).toBe("salary");
    expect(
      classifyTransactionDescription("Pix recebido", DEFAULT_INCOME_CATEGORY_RULES, UNCATEGORIZED_INCOME_CATEGORY_ID)
    ).toBe(UNCATEGORIZED_INCOME_CATEGORY_ID);
  });
});

describe("classifyTransactionList", () => {
  it("acrescenta categoryId mantendo os demais campos", () => {
    const transactions = [
      { id: "1", date: "2026-03-01", merchant: "UBER TRIP", amount: 25, bank: "Nubank" as const },
      { id: "2", date: "2026-03-02", merchant: "Loja desconhecida", amount: 40 },
    ];

    expect(classifyTransactionList(transactions)).toEqual([
      { ...transactions[0], categoryId: "transport" },
      { ...transactions[1], categoryId: UNCATEGORIZED_CATEGORY_ID },
    ]);
  });
});
