import { EMPTY, BLACK, RED, BLACK_KING, RED_KING } from "@eschaton/shared";
import type { MockCheckersState, MockBackgammonState, MockRiskState } from "./mockStates";

type GameState = MockCheckersState | MockBackgammonState | MockRiskState;
type StateChangeCallback = (newState: GameState) => void;

export class SandboxStatePanel {
  private readonly element: HTMLDivElement;
  private gameType: string;
  private state: GameState;
  private onStateChangeCallback: StateChangeCallback | null = null;

  constructor(gameType: string, initialState: GameState) {
    this.gameType = gameType;
    this.state = initialState;
    this.element = document.createElement("div");
    this.element.id = "sandbox-panel";
    this.initStyles();
    this.render();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.element);
  }

  destroy(): void {
    this.element.remove();
  }

  onStateChange(callback: StateChangeCallback): void {
    this.onStateChangeCallback = callback;
  }

  private initStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      #sandbox-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        max-height: 80vh;
        overflow-y: auto;
        background: rgba(24, 24, 27, 0.95);
        border: 1px solid rgba(63, 63, 70, 0.5);
        border-radius: 8px;
        padding: 16px;
        font-family: monospace;
        font-size: 12px;
        color: #FFFFFF;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        z-index: 1000;
      }
      #sandbox-panel h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #A78BFA;
        border-bottom: 1px solid rgba(63, 63, 70, 0.5);
        padding-bottom: 8px;
      }
      #sandbox-panel label {
        display: block;
        margin: 8px 0 4px 0;
        color: #A1A1A1;
        font-size: 11px;
      }
      #sandbox-panel input,
      #sandbox-panel select,
      #sandbox-panel textarea {
        width: 100%;
        background: rgba(9, 9, 11, 0.7);
        border: 1px solid rgba(63, 63, 70, 0.5);
        border-radius: 4px;
        color: #FFFFFF;
        padding: 6px 8px;
        font-family: monospace;
        font-size: 11px;
        box-sizing: border-box;
      }
      #sandbox-panel input:focus,
      #sandbox-panel select:focus,
      #sandbox-panel textarea:focus {
        outline: none;
        border-color: #A78BFA;
      }
      #sandbox-panel .board-grid {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 2px;
        margin: 8px 0;
      }
      #sandbox-panel .board-cell {
        aspect-ratio: 1;
        background: rgba(63, 63, 70, 0.3);
        border: 1px solid rgba(63, 63, 70, 0.5);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        border-radius: 2px;
      }
      #sandbox-panel .board-cell:hover {
        background: rgba(167, 139, 250, 0.2);
        border-color: #A78BFA;
      }
      #sandbox-panel .board-cell.dark {
        background: rgba(24, 24, 27, 0.7);
      }
      #sandbox-panel button {
        background: #7C3AED;
        border: none;
        border-radius: 4px;
        color: #FFFFFF;
        padding: 8px 12px;
        font-family: monospace;
        font-size: 11px;
        cursor: pointer;
        margin-top: 8px;
      }
      #sandbox-panel button:hover {
        background: #A78BFA;
      }
    `;
    document.head.appendChild(style);
  }

  private render(): void {
    if (this.gameType === "checkers") {
      this.renderCheckersControls();
    } else if (this.gameType === "backgammon") {
      this.renderBackgammonControls();
    } else if (this.gameType === "risk") {
      this.renderRiskControls();
    }
  }

  private renderCheckersControls(): void {
    const state = this.state as MockCheckersState;
    
    this.element.innerHTML = `
      <h3>🎮 Checkers Sandbox</h3>
      <label>Board (click cells to cycle pieces)</label>
      <div class="board-grid" id="checkers-board"></div>
      <label>Must Capture From</label>
      <input type="number" id="must-capture" value="${state.mustCaptureFrom}" min="-1" max="63" />
    `;

    const boardGrid = this.element.querySelector("#checkers-board")!;
    for (let i = 0; i < 64; i++) {
      const cell = document.createElement("div");
      cell.className = "board-cell";
      const row = Math.floor(i / 8);
      const col = i % 8;
      if ((row + col) % 2 === 1) {
        cell.classList.add("dark");
      }
      
      cell.textContent = this.getPieceEmoji(state.board[i]);
      cell.addEventListener("click", () => this.cyclePiece(i));
      boardGrid.appendChild(cell);
    }

    const mustCaptureInput = this.element.querySelector("#must-capture") as HTMLInputElement;
    mustCaptureInput.addEventListener("change", () => {
      (this.state as MockCheckersState).mustCaptureFrom = parseInt(mustCaptureInput.value, 10);
      this.notifyStateChange();
    });
  }

  private renderBackgammonControls(): void {
    const state = this.state as MockBackgammonState;
    
    this.element.innerHTML = `
      <h3>🎮 Backgammon Sandbox</h3>
      <label>State JSON (edit and press Update)</label>
      <textarea id="state-json" rows="15">${JSON.stringify({
        points: state.points,
        blackBar: state.blackBar,
        redBar: state.redBar,
        blackBorneOff: state.blackBorneOff,
        redBorneOff: state.redBorneOff,
        dice: state.dice,
        usedDice: state.usedDice,
      }, null, 2)}</textarea>
      <button id="update-btn">Update State</button>
    `;

    const updateBtn = this.element.querySelector("#update-btn") as HTMLButtonElement;
    updateBtn.addEventListener("click", () => this.updateBackgammonFromJSON());
  }

  private renderRiskControls(): void {
    const state = this.state as MockRiskState;
    
    const territoriesArray = Array.from(state.territories.entries()).map(([id, t]) => ({
      id,
      ...t,
    }));

    this.element.innerHTML = `
      <h3>🎮 Risk Sandbox</h3>
      <label>State JSON (edit and press Update)</label>
      <textarea id="state-json" rows="15">${JSON.stringify({
        territories: territoriesArray,
        turnPhase: state.turnPhase,
        gamePhase: state.gamePhase,
      }, null, 2)}</textarea>
      <button id="update-btn">Update State</button>
    `;

    const updateBtn = this.element.querySelector("#update-btn") as HTMLButtonElement;
    updateBtn.addEventListener("click", () => this.updateRiskFromJSON());
  }

  private getPieceEmoji(piece: number): string {
    switch (piece) {
      case BLACK:
        return "⚫";
      case RED:
        return "🔴";
      case BLACK_KING:
        return "👑";
      case RED_KING:
        return "💎";
      default:
        return "";
    }
  }

  private cyclePiece(index: number): void {
    const state = this.state as MockCheckersState;
    const current = state.board[index];
    const cycle = [EMPTY, BLACK, RED, BLACK_KING, RED_KING];
    const currentIndex = cycle.indexOf(current);
    const nextIndex = (currentIndex + 1) % cycle.length;
    state.board[index] = cycle[nextIndex];
    
    this.render();
    this.notifyStateChange();
  }

  private updateBackgammonFromJSON(): void {
    try {
      const textarea = this.element.querySelector("#state-json") as HTMLTextAreaElement;
      const json = JSON.parse(textarea.value);
      const state = this.state as MockBackgammonState;
      
      if (json.points) state.points = json.points;
      if (typeof json.blackBar === "number") state.blackBar = json.blackBar;
      if (typeof json.redBar === "number") state.redBar = json.redBar;
      if (typeof json.blackBorneOff === "number") state.blackBorneOff = json.blackBorneOff;
      if (typeof json.redBorneOff === "number") state.redBorneOff = json.redBorneOff;
      if (json.dice) state.dice = json.dice;
      if (json.usedDice) state.usedDice = json.usedDice;
      
      this.notifyStateChange();
    } catch (error) {
      alert(`Invalid JSON: ${error}`);
    }
  }

  private updateRiskFromJSON(): void {
    try {
      const textarea = this.element.querySelector("#state-json") as HTMLTextAreaElement;
      const json = JSON.parse(textarea.value);
      const state = this.state as MockRiskState;
      
      if (json.territories) {
        state.territories = new Map(
          json.territories.map((t: { id: string; owner: string; armyCount: number }) => [
            t.id,
            { owner: t.owner, armyCount: t.armyCount },
          ])
        );
      }
      if (json.turnPhase) state.turnPhase = json.turnPhase;
      if (json.gamePhase) state.gamePhase = json.gamePhase;
      
      this.notifyStateChange();
    } catch (error) {
      alert(`Invalid JSON: ${error}`);
    }
  }

  private notifyStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state);
    }
  }
}
