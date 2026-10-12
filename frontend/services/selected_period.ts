// mês ("YYYY-MM") escolhido nas abas Visão geral e Transações, que ficam sempre no mesmo período
export const SELECTED_PERIOD_CHANGED_EVENT = "billie:selected-period-changed";

let selectedPeriod = "";

export function getSelectedPeriod(): string {
  return selectedPeriod;
}

export function setSelectedPeriod(period: string): void {
  if (period === selectedPeriod) return;
  selectedPeriod = period;
  document.dispatchEvent(new Event(SELECTED_PERIOD_CHANGED_EVENT));
}

// mantém o período atual se ele ainda existir nos dados; senão cai no primeiro disponível
export function syncSelectedPeriodWithAvailableList(availablePeriods: string[]): string {
  setSelectedPeriod(availablePeriods.includes(selectedPeriod) ? selectedPeriod : (availablePeriods[0] ?? ""));
  return selectedPeriod;
}

export function listenSelectedPeriodChanged(listener: () => void): void {
  document.addEventListener(SELECTED_PERIOD_CHANGED_EVENT, listener);
}
