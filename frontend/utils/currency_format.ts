// Intl.NumberFormat converte a entrada para número: um valor que não é número vira "R$ NaN", nunca o texto
// original (`"<img>".toLocaleString()` devolveria a própria string, que vai sem escape para o innerHTML).
const BRL_CURRENCY_FORMAT = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBrlCurrency(value: number): string {
  return BRL_CURRENCY_FORMAT.format(value);
}
