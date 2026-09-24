export function groupPossibleDuplicateRows<T extends { date: string; amount: number; duplicateDismissed?: boolean }>(
  rows: T[]
): T[][] {
  const rowsByDateAndAmount = new Map<string, T[]>();

  for (const row of rows) {
    const key = `${row.date}|${row.amount.toFixed(2)}`;
    const group = rowsByDateAndAmount.get(key) ?? [];
    group.push(row);
    rowsByDateAndAmount.set(key, group);
  }

  // Um grupo já marcado como "não é duplicado" volta a ser sinalizado se ganhar um lançamento novo (não dispensado).
  return [...rowsByDateAndAmount.values()].filter(
    (group) => group.length > 1 && group.some((row) => !row.duplicateDismissed)
  );
}
