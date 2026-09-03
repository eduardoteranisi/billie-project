import type { Category, CategoryRule, CategorizedTransaction, Transaction } from "../types";
import { normalizeText } from "./text_utils";

export const UNCATEGORIZED_CATEGORY_ID = "other";
export const UNCATEGORIZED_INCOME_CATEGORY_ID = "other-income";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "housing", label: "Moradia", type: "expense", group: "fixed" },
  { id: "utilities", label: "Contas e Serviços", type: "expense", group: "fixed" },
  { id: "health", label: "Saúde", type: "expense", group: "fixed" },
  { id: "subscriptions", label: "Assinaturas", type: "expense", group: "fixed" },
  { id: "transport", label: "Transporte", type: "expense", group: "variable" },
  { id: "food", label: "Alimentação", type: "expense", group: "variable" },
  { id: "shopping", label: "Compras", type: "expense", group: "variable" },
  { id: "leisure", label: "Lazer", type: "expense", group: "variable" },
  { id: UNCATEGORIZED_CATEGORY_ID, label: "Outros / Não categorizado", type: "expense", group: "variable" },
];

export const DEFAULT_INCOME_CATEGORIES: Category[] = [
  { id: "salary", label: "Salário", type: "income" },
  { id: "freelance", label: "Freelance / PJ", type: "income" },
  { id: "investments", label: "Investimentos", type: "income" },
  { id: "reimbursement", label: "Reembolso", type: "income" },
  { id: UNCATEGORIZED_INCOME_CATEGORY_ID, label: "Outros / Não categorizado", type: "income" },
];

export const DEFAULT_CATEGORY_RULES: CategoryRule[] = [
  { categoryId: "housing", keywords: ["ALUGUEL", "CONDOMINIO", "IMOBILIARIA"] },
  {
    categoryId: "utilities",
    keywords: ["ENEL", "LIGHT", "SABESP", "COMGAS", "VIVO", "CLARO", "TIM", "INTERNET", "NET SERVICO"],
  },
  {
    categoryId: "health",
    keywords: ["FARMACIA", "DROGARIA", "DROGASIL", "PAGUE MENOS", "HOSPITAL", "CLINICA", "LABORATORIO"],
  },
  {
    categoryId: "subscriptions",
    keywords: ["NETFLIX", "SPOTIFY", "AMAZON PRIME", "DISNEY", "HBO", "YOUTUBE PREMIUM", "ICLOUD", "GOOGLE ONE"],
  },
  {
    categoryId: "transport",
    keywords: ["UBER", "99APP", "99POP", "TAXI", "POSTO", "SHELL", "IPIRANGA", "ESTACIONAMENTO"],
  },
  {
    categoryId: "food",
    keywords: [
      "IFOOD",
      "RAPPI",
      "RESTAURANTE",
      "PADARIA",
      "MERCADO",
      "SUPERMERCADO",
      "CARREFOUR",
      "PAO DE ACUCAR",
      "ASSAI",
    ],
  },
  {
    categoryId: "shopping",
    keywords: ["AMAZON", "MERCADO LIVRE", "MAGAZINE LUIZA", "AMERICANAS", "SHEIN", "SHOPEE"],
  },
  { categoryId: "leisure", keywords: ["CINEMA", "INGRESSO", "STEAM", "PLAYSTATION", "BALADA"] },
];

export const DEFAULT_INCOME_CATEGORY_RULES: CategoryRule[] = [
  { categoryId: "salary", keywords: ["SALARIO", "HOLERITE", "FOLHA DE PAGAMENTO"] },
  { categoryId: "freelance", keywords: ["FREELANCE", "FREELA", "RPA", "NOTA FISCAL", "PRESTACAO DE SERVICO"] },
  { categoryId: "investments", keywords: ["DIVIDENDO", "RENDIMENTO", "JUROS", "JCP", "RESGATE"] },
  { categoryId: "reimbursement", keywords: ["REEMBOLSO", "ESTORNO"] },
];

export function classifyTransactionDescription(
  description: string,
  rules: CategoryRule[] = DEFAULT_CATEGORY_RULES,
  fallbackCategoryId: string = UNCATEGORIZED_CATEGORY_ID
): string {
  const normalizedDescription = normalizeText(description);

  for (const rule of rules) {
    const matches = rule.keywords.some((keyword) => normalizedDescription.includes(normalizeText(keyword)));
    if (matches) return rule.categoryId;
  }

  return fallbackCategoryId;
}

export function classifyTransactionList(
  transactions: Transaction[],
  rules: CategoryRule[] = DEFAULT_CATEGORY_RULES,
  fallbackCategoryId: string = UNCATEGORIZED_CATEGORY_ID
): CategorizedTransaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    categoryId: classifyTransactionDescription(transaction.merchant, rules, fallbackCategoryId),
  }));
}
