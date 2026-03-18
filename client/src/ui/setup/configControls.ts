/**
 * Shared UI control factories for game setup config panels.
 * All controls follow the design-tokens.css glass morphism pattern.
 */

import type { CreateGamePayload } from "../LobbyScreen";

export interface SetupConfigPanel {
  readonly element: HTMLElement;
  getPayloadOverrides(): Partial<CreateGamePayload>;
  setReadOnly(readOnly: boolean): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// Panel wrapper
// ---------------------------------------------------------------------------

export function createPanel(title: string, icon?: string): HTMLElement {
  const panel = el("div", "setup-panel");
  const header = el("div", "setup-panel-header");

  if (icon) {
    const iconEl = el("span", "setup-panel-icon", icon);
    header.append(iconEl);
  }

  header.append(el("h3", "setup-panel-title", title));
  panel.append(header);
  return panel;
}

// ---------------------------------------------------------------------------
// Option group (radio-like buttons)
// ---------------------------------------------------------------------------

export interface OptionDef<T extends string> {
  value: T;
  label: string;
  description: string;
  trailing?: string;
}

export interface OptionGroupResult<T extends string> {
  element: HTMLElement;
  getValue(): T;
  setValue(value: T): void;
  setReadOnly(readOnly: boolean): void;
}

export function createOptionGroup<T extends string>(
  options: OptionDef<T>[],
  initial: T,
  onChange?: (value: T) => void,
): OptionGroupResult<T> {
  let current = initial;
  let readOnly = false;
  const container = el("div", "setup-option-group");
  const buttons: HTMLButtonElement[] = [];

  for (const opt of options) {
    const btn = el("button", "setup-option-btn") as HTMLButtonElement;
    btn.type = "button";
    btn.dataset.value = opt.value;

    const row = el("div", "setup-option-btn-row");
    const textCol = el("div", "setup-option-btn-text");
    textCol.append(
      el("span", "setup-option-label", opt.label),
      el("span", "setup-option-desc", opt.description),
    );
    row.append(textCol);

    if (opt.trailing) {
      row.append(el("span", "setup-option-trailing", opt.trailing));
    }

    btn.append(row);
    btn.addEventListener("click", () => {
      if (readOnly) return;
      current = opt.value;
      syncSelected();
      onChange?.(current);
    });

    buttons.push(btn);
    container.append(btn);
  }

  function syncSelected(): void {
    for (const b of buttons) {
      b.classList.toggle("selected", b.dataset.value === current);
    }
  }

  syncSelected();

  return {
    element: container,
    getValue: () => current,
    setValue(value: T) {
      current = value;
      syncSelected();
    },
    setReadOnly(ro: boolean) {
      readOnly = ro;
      for (const b of buttons) {
        b.disabled = ro;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Toggle row (checkbox with label)
// ---------------------------------------------------------------------------

export interface ToggleRowResult {
  element: HTMLElement;
  getValue(): boolean;
  setReadOnly(readOnly: boolean): void;
}

export function createToggleRow(
  label: string,
  description: string,
  initial: boolean,
  onChange?: (value: boolean) => void,
): ToggleRowResult {
  let current = initial;
  const row = el("label", "setup-toggle-row");
  const textCol = el("div", "setup-toggle-text");
  textCol.append(
    el("span", "setup-toggle-label", label),
    el("span", "setup-toggle-desc", description),
  );

  const checkbox = el("input") as HTMLInputElement;
  checkbox.type = "checkbox";
  checkbox.className = "setup-toggle-input";
  checkbox.checked = initial;
  checkbox.addEventListener("change", () => {
    current = checkbox.checked;
    onChange?.(current);
  });

  row.append(textCol, checkbox);

  return {
    element: row,
    getValue: () => current,
    setReadOnly(ro: boolean) {
      checkbox.disabled = ro;
      row.classList.toggle("read-only", ro);
    },
  };
}

// ---------------------------------------------------------------------------
// Stepper (numeric +/- control)
// ---------------------------------------------------------------------------

export interface StepperResult {
  element: HTMLElement;
  getValue(): number;
  setReadOnly(readOnly: boolean): void;
}

export function createStepper(
  label: string,
  min: number,
  max: number,
  step: number,
  initial: number,
  format: (v: number) => string,
  onChange?: (value: number) => void,
): StepperResult {
  let current = initial;
  let readOnly = false;

  const wrapper = el("div", "setup-stepper");
  const labelEl = el("label", "setup-stepper-label", label);

  const controls = el("div", "setup-stepper-controls");
  const minusBtn = el("button", "setup-stepper-btn") as HTMLButtonElement;
  minusBtn.type = "button";
  minusBtn.textContent = "−";
  minusBtn.addEventListener("click", () => {
    if (readOnly) return;
    current = Math.max(min, current - step);
    sync();
    onChange?.(current);
  });

  const display = el("div", "setup-stepper-display");
  display.textContent = format(initial);

  const plusBtn = el("button", "setup-stepper-btn") as HTMLButtonElement;
  plusBtn.type = "button";
  plusBtn.textContent = "+";
  plusBtn.addEventListener("click", () => {
    if (readOnly) return;
    current = Math.min(max, current + step);
    sync();
    onChange?.(current);
  });

  controls.append(minusBtn, display, plusBtn);
  wrapper.append(labelEl, controls);

  function sync(): void {
    display.textContent = format(current);
    minusBtn.disabled = readOnly || current <= min;
    plusBtn.disabled = readOnly || current >= max;
  }

  sync();

  return {
    element: wrapper,
    getValue: () => current,
    setReadOnly(ro: boolean) {
      readOnly = ro;
      sync();
    },
  };
}
