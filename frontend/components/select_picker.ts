const MENU_GAP_PX = 4;
const MENU_EDGE_MARGIN_PX = 8;
const OPEN_MENU_KEYS = new Set(["Enter", " ", "F4"]);

let activeMenu: HTMLDivElement | null = null;
let activeSelect: HTMLSelectElement | null = null;

export function installSelectPickerMenu(): void {
  document.addEventListener("mousedown", onSelectMouseDown, true);
  document.addEventListener("keydown", onSelectKeyDown, true);
}

function onSelectMouseDown(event: MouseEvent): void {
  const select = pickableSelectFromTarget(event.target);
  if (!select || event.button !== 0) return;

  // impede a lista nativa: no app desktop (WebKitGTK) ela não passa da borda da janela e corta as opções.
  event.preventDefault();
  select.focus();
  toggleSelectPickerMenu(select);
}

function onSelectKeyDown(event: KeyboardEvent): void {
  const select = pickableSelectFromTarget(event.target);
  if (!select) return;

  const opensMenu = OPEN_MENU_KEYS.has(event.key) || (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp"));
  if (!opensMenu) return;

  event.preventDefault();
  toggleSelectPickerMenu(select);
}

function pickableSelectFromTarget(target: EventTarget | null): HTMLSelectElement | null {
  if (!(target instanceof HTMLSelectElement)) return null;
  if (target.multiple || target.disabled || target.size > 1) return null;
  return target;
}

function toggleSelectPickerMenu(select: HTMLSelectElement): void {
  const wasOpenForSelect = activeSelect === select;
  closeSelectPickerMenu();
  if (wasOpenForSelect || select.options.length === 0) return;

  const menu = buildMenuElement(select, (optionIndex) => {
    closeSelectPickerMenu();
    select.focus();
    if (optionIndex === select.selectedIndex) return;

    select.selectedIndex = optionIndex;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  document.body.appendChild(menu);
  positionMenuNearSelect(menu, select);

  activeMenu = menu;
  activeSelect = select;
  select.setAttribute("aria-expanded", "true");

  // foco adiado: se o menu abriu pelo Enter, o resto desse mesmo evento de tecla "clicaria" a opção focada.
  setTimeout(() => {
    const initialOption =
      menu.querySelector<HTMLButtonElement>('[aria-selected="true"]:not(:disabled)') ??
      menu.querySelector<HTMLButtonElement>(".select-picker-option:not(:disabled)");
    initialOption?.focus();
  }, 0);

  document.addEventListener("pointerdown", onOutsidePointerDown, true);
  document.addEventListener("scroll", onPageScroll, true);
  window.addEventListener("resize", closeSelectPickerMenu);
}

function closeSelectPickerMenu(): void {
  activeMenu?.remove();
  activeSelect?.removeAttribute("aria-expanded");
  activeMenu = null;
  activeSelect = null;

  document.removeEventListener("pointerdown", onOutsidePointerDown, true);
  document.removeEventListener("scroll", onPageScroll, true);
  window.removeEventListener("resize", closeSelectPickerMenu);
}

function buildMenuElement(select: HTMLSelectElement, onOptionChosen: (optionIndex: number) => void): HTMLDivElement {
  const menu = document.createElement("div");
  menu.className = "select-picker-menu";
  menu.setAttribute("role", "listbox");

  Array.from(select.options).forEach((selectOption, optionIndex) => {
    if (selectOption.hidden) return;

    const option = document.createElement("button");
    option.type = "button";
    option.className = "select-picker-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(optionIndex === select.selectedIndex));
    option.disabled = selectOption.disabled;
    option.textContent = selectOption.textContent || " ";
    option.addEventListener("click", () => onOptionChosen(optionIndex));
    menu.appendChild(option);
  });

  menu.addEventListener("keydown", (event) => onMenuKeyDown(event, menu));
  return menu;
}

function positionMenuNearSelect(menu: HTMLDivElement, select: HTMLSelectElement): void {
  const selectRect = select.getBoundingClientRect();
  const spaceBelow = window.innerHeight - selectRect.bottom - MENU_GAP_PX - MENU_EDGE_MARGIN_PX;
  const spaceAbove = selectRect.top - MENU_GAP_PX - MENU_EDGE_MARGIN_PX;
  const naturalHeight = menu.scrollHeight;
  const opensUpward = naturalHeight > spaceBelow && spaceAbove > spaceBelow;

  menu.style.maxHeight = `${Math.max(opensUpward ? spaceAbove : spaceBelow, 0)}px`;
  menu.style.minWidth = `${selectRect.width}px`;

  const menuWidth = menu.offsetWidth;
  const maxLeft = window.innerWidth - menuWidth - MENU_EDGE_MARGIN_PX;
  menu.style.left = `${Math.max(MENU_EDGE_MARGIN_PX, Math.min(selectRect.left, maxLeft))}px`;

  if (opensUpward) {
    menu.style.bottom = `${window.innerHeight - selectRect.top + MENU_GAP_PX}px`;
  } else {
    menu.style.top = `${selectRect.bottom + MENU_GAP_PX}px`;
  }
}

function onMenuKeyDown(event: KeyboardEvent, menu: HTMLDivElement): void {
  const options = Array.from(menu.querySelectorAll<HTMLButtonElement>(".select-picker-option:not(:disabled)"));
  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    options[(currentIndex + step + options.length) % options.length]?.focus();
  } else if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    options[event.key === "Home" ? 0 : options.length - 1]?.focus();
  } else if (event.key === "Escape" || event.key === "Tab") {
    event.preventDefault();
    const select = activeSelect;
    closeSelectPickerMenu();
    select?.focus();
  }
}

function onOutsidePointerDown(event: PointerEvent): void {
  const target = event.target as Node;
  if (activeMenu?.contains(target) || activeSelect?.contains(target)) return;
  closeSelectPickerMenu();
}

function onPageScroll(event: Event): void {
  // rolar a própria lista de opções não deve fechá-la; rolar a página sim, senão o menu "flutua" solto.
  if (activeMenu?.contains(event.target as Node)) return;
  closeSelectPickerMenu();
}
