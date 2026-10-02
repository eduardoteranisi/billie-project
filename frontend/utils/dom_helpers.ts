export function getRequiredElementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`elemento #${id} não encontrado`);
  return element as T;
}
