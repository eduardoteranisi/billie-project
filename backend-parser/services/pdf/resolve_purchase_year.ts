export function resolvePurchaseYear(
  month: number,
  yearParam: string,
  now: Date,
  options: { explicitYear?: number; alwaysAdjustForRollover?: boolean } = {}
): number {
  if (options.explicitYear !== undefined) return options.explicitYear;

  const hasYearParam = /^\d+$/.test(yearParam);
  let year = hasYearParam ? Number(yearParam) : now.getFullYear();

  if ((options.alwaysAdjustForRollover || !hasYearParam) && month > now.getMonth() + 1) {
    year -= 1;
  }

  return year;
}
