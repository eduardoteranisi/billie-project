import type { Category, CategoryRule, CategorizedTransaction, Transaction } from "../types";

export const UNCATEGORIZED_CATEGORY_ID = "other";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "housing", label: "Moradia", group: "fixed" },
  { id: "utilities", label: "Contas e Serviços", group: "fixed" },
  { id: "health", label: "Saúde", group: "fixed" },
  { id: "subscriptions", label: "Assinaturas", group: "fixed" },
  { id: "transport", label: "Transporte", group: "variable" },
  { id: "food", label: "Alimentação", group: "variable" },
  { id: "shopping", label: "Compras", group: "variable" },
  { id: "leisure", label: "Lazer", group: "variable" },
  { id: UNCATEGORIZED_CATEGORY_ID, label: "Outros / Não categorizado", group: "variable" },
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

export function classifyTransaction(
  description: string,
  rules: CategoryRule[] = DEFAULT_CATEGORY_RULES
): string {
  const normalizedDescription = normalizeText(description);

  for (const rule of rules) {
    const matches = rule.keywords.some((keyword) => normalizedDescription.includes(normalizeText(keyword)));
    if (matches) return rule.categoryId;
  }

  return UNCATEGORIZED_CATEGORY_ID;
}

export function classifyTransactions(
  transactions: Transaction[],
  rules: CategoryRule[] = DEFAULT_CATEGORY_RULES
): CategorizedTransaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    categoryId: classifyTransaction(transaction.merchant, rules),
  }));
}

function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
