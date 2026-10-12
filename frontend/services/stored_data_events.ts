// avisa as telas que leem o IndexedDB (Visão geral, Transações, modal de categorias) que algo foi gravado
export const STORED_DATA_UPDATED_EVENT = "billie:stored-data-updated";

export function notifyStoredDataUpdated(): void {
  document.dispatchEvent(new Event(STORED_DATA_UPDATED_EVENT));
}

export function listenStoredDataUpdated(listener: () => void): void {
  document.addEventListener(STORED_DATA_UPDATED_EVENT, listener);
}
