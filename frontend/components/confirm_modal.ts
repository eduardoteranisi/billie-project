import { getRequiredElementById } from "../utils/dom_helpers";

export function confirmAction(message: string): Promise<boolean> {
  const modal = getRequiredElementById<HTMLDivElement>("modal-confirm");
  const confirmButton = getRequiredElementById<HTMLButtonElement>("modal-confirm-confirm");
  const cancelButton = getRequiredElementById<HTMLButtonElement>("modal-confirm-cancel");
  getRequiredElementById<HTMLParagraphElement>("modal-confirm-message").textContent = message;

  return new Promise((resolve) => {
    const finish = (result: boolean) => {
      modal.hidden = true;
      confirmButton.removeEventListener("click", onConfirm);
      cancelButton.removeEventListener("click", onCancel);
      resolve(result);
    };
    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);

    confirmButton.addEventListener("click", onConfirm);
    cancelButton.addEventListener("click", onCancel);
    modal.hidden = false;
  });
}
