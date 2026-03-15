function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  textContent?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

export class ReconnectOverlay {
  private readonly overlay: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly subtitleEl: HTMLParagraphElement;
  private readonly spinnerEl: HTMLDivElement;

  constructor() {
    const overlay = document.getElementById("reconnect-overlay");
    if (!overlay) {
      throw new Error("Missing #reconnect-overlay");
    }

    this.overlay = overlay;
    this.overlay.textContent = "";
    this.overlay.setAttribute("role", "status");
    this.overlay.setAttribute("aria-live", "polite");

    this.panel = createElement("section", "reconnect-panel");
    const badge = createElement("span", "reconnect-badge", "Connection");
    this.spinnerEl = createElement("div", "reconnect-spinner") as HTMLDivElement;
    this.titleEl = createElement("h2", "reconnect-title", "Reconnecting...") as HTMLHeadingElement;
    this.subtitleEl = createElement(
      "p",
      "reconnect-subtitle",
      "Trying to restore your game session.",
    ) as HTMLParagraphElement;

    this.panel.append(badge, this.spinnerEl, this.titleEl, this.subtitleEl);
    this.overlay.append(this.panel);
  }

  showReconnecting(message = "Trying to restore your game session."): void {
    this.setState("reconnecting", "Reconnecting...", message);
  }

  showReconnected(message = "You're back in the game."): void {
    this.setState("success", "Reconnected!", message);
  }

  showFailure(message = "Returning to lobby..."): void {
    this.setState("error", "Connection lost.", message);
  }

  hide(): void {
    this.overlay.classList.remove("visible");
    this.panel.classList.remove("is-success", "is-error");
    this.spinnerEl.hidden = false;
  }

  private setState(
    tone: "reconnecting" | "success" | "error",
    title: string,
    subtitle: string,
  ): void {
    this.overlay.classList.add("visible");
    this.panel.classList.toggle("is-success", tone === "success");
    this.panel.classList.toggle("is-error", tone === "error");
    this.spinnerEl.hidden = tone !== "reconnecting";
    this.titleEl.textContent = title;
    this.subtitleEl.textContent = subtitle;
  }
}
