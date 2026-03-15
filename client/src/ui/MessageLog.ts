import type { LobbyLogEntry } from "@eschaton/shared";

export class MessageLog {
  private container: HTMLElement;
  private logList: HTMLElement;
  private maxMessages = 50;
  private messages: LobbyLogEntry[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.logList = this.createLogList();
    this.container.appendChild(this.logList);
  }

  private createLogList(): HTMLElement {
    const list = document.createElement("div");
    list.className = "message-log-list";
    return list;
  }

  addMessage(entry: LobbyLogEntry): void {
    this.messages.push(entry);

    if (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    this.render();
    this.scrollToBottom();
  }

  clear(): void {
    this.messages = [];
    this.render();
  }

  private render(): void {
    this.logList.innerHTML = "";

    for (const message of this.messages) {
      const messageElement = this.createMessageElement(message);
      this.logList.appendChild(messageElement);
    }
  }

  private createMessageElement(entry: LobbyLogEntry): HTMLElement {
    const element = document.createElement("div");
    element.className = `message-log-entry message-log-entry--${entry.type}`;

    const timestamp = this.formatTimestamp(entry.timestamp);
    const timeElement = document.createElement("span");
    timeElement.className = "message-log-time";
    timeElement.textContent = timestamp;

    const messageElement = document.createElement("span");
    messageElement.className = "message-log-text";
    messageElement.textContent = entry.message;

    element.appendChild(timeElement);
    element.appendChild(messageElement);

    return element;
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  private scrollToBottom(): void {
    this.container.scrollTop = this.container.scrollHeight;
  }

  destroy(): void {
    this.container.innerHTML = "";
  }
}
