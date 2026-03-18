import type { GameResult } from "@eschaton/shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLE_ID = "playgrid-victory-screen-styles";
const CONTAINER_ID = "victory-screen-overlay";

const GAME_LABELS: Record<string, string> = {
  checkers: "Checkers",
  backgammon: "Backgammon",
  risk: "Risk",
  dominos: "Dominos",
};

// Game-specific score labels when metadata doesn't provide one
const SCORE_LABELS: Record<string, string> = {
  checkers: "Pieces",
  backgammon: "Points",
  risk: "Territories",
  dominos: "Score",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VictoryScreenEvent =
  | { type: "play_again"; gameType: string }
  | { type: "back_to_lobby" };

export interface VictoryPlayerInfo {
  sessionId: string;
  displayName: string;
  playerIndex: number;
}

export interface VictoryScreenData {
  result: GameResult;
  sessionId: string;
  gameType: string;
  players?: VictoryPlayerInfo[];
}

type OutcomeKind = "victory" | "defeat" | "draw";

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

function resolveOutcome(result: GameResult, sessionId: string): OutcomeKind {
  if (result.type === "draw") {
    return "draw";
  }

  if (result.winnerId === sessionId) {
    return "victory";
  }

  return "defeat";
}

function resolveHeading(outcome: OutcomeKind, resultType: GameResult["type"]): string {
  if (outcome === "draw") return "Draw!";
  if (outcome === "victory") return "Victory!";
  if (resultType === "forfeit") return "Forfeit";
  if (resultType === "timeout") return "Time Out";
  return "Defeat";
}

function resolveSubheading(
  outcome: OutcomeKind,
  result: GameResult,
  winnerName: string | null,
): string {
  if (outcome === "draw") return "The game ended in a draw.";

  if (outcome === "victory") {
    if (result.type === "forfeit") return "You won by forfeit!";
    if (result.type === "timeout") return "You won — opponent ran out of time!";
    return "You won the game!";
  }

  if (result.type === "forfeit") return "Game ended by forfeit.";
  if (result.type === "timeout") return "Game ended due to timeout.";
  return winnerName ? `${winnerName} wins the game!` : "You lost the game.";
}

function resolveTrophyEmoji(outcome: OutcomeKind): string {
  if (outcome === "victory") return "🏆";
  if (outcome === "draw") return "🤝";
  return "⚔️";
}

function resolveAccentClass(outcome: OutcomeKind): string {
  if (outcome === "victory") return "vs-accent-victory";
  if (outcome === "draw") return "vs-accent-draw";
  return "vs-accent-defeat";
}

function statIcon(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("duration") || lower.includes("time")) return "⏱️";
  if (lower.includes("move")) return "📊";
  if (lower.includes("piece") || lower.includes("score")) return "🎯";
  if (lower.includes("capture") || lower.includes("kill")) return "⚡";
  if (lower.includes("king") || lower.includes("crown")) return "👑";
  if (lower.includes("territor")) return "📍";
  if (lower.includes("arm")) return "⚔️";
  if (lower.includes("accuracy") || lower.includes("rate")) return "📈";
  if (lower.includes("point")) return "🎯";
  return "📋";
}

function getWinnerName(result: GameResult, players?: VictoryPlayerInfo[]): string | null {
  if (!result.winnerId) return null;

  const meta = result.metadata as Record<string, unknown> | undefined;
  if (typeof meta?.winnerName === "string") return meta.winnerName;

  const player = players?.find((p) => p.sessionId === result.winnerId);
  return player?.displayName ?? null;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Stats extraction
// ---------------------------------------------------------------------------

interface StatEntry {
  label: string;
  value: string;
}

function extractPlayerStats(
  result: GameResult,
  sessionId: string,
  gameType: string,
  players?: VictoryPlayerInfo[],
): { localStats: StatEntry[]; opponentStats: StatEntry[]; summaryStats: StatEntry[] } {
  const meta = (result.metadata ?? {}) as Record<string, unknown>;
  const scoreLabel = SCORE_LABELS[gameType] ?? "Score";
  const localScore = result.scores[sessionId];
  const summaryStats: StatEntry[] = [];
  const localStats: StatEntry[] = [];
  const opponentStats: StatEntry[] = [];

  // Duration
  if (typeof meta.durationSeconds === "number") {
    summaryStats.push({ label: "Duration", value: formatDuration(meta.durationSeconds as number) });
  }

  // Total moves
  if (typeof meta.totalMoves === "number") {
    summaryStats.push({ label: "Total Moves", value: String(meta.totalMoves) });
  }

  // Local player score
  if (localScore !== undefined) {
    localStats.push({ label: scoreLabel, value: String(localScore) });
  }

  // Add game-specific metadata stats for local player
  const localMeta = meta[sessionId] as Record<string, unknown> | undefined;
  if (localMeta && typeof localMeta === "object") {
    for (const [key, val] of Object.entries(localMeta)) {
      if (val !== undefined && val !== null) {
        localStats.push({ label: formatStatLabel(key), value: String(val) });
      }
    }
  }

  // Opponent stats
  const opponentIds = Object.keys(result.scores).filter((id) => id !== sessionId);
  const opponentId = opponentIds[0];

  if (opponentId) {
    const oppScore = result.scores[opponentId];
    if (oppScore !== undefined) {
      opponentStats.push({ label: scoreLabel, value: String(oppScore) });
    }

    const oppMeta = meta[opponentId] as Record<string, unknown> | undefined;
    if (oppMeta && typeof oppMeta === "object") {
      for (const [key, val] of Object.entries(oppMeta)) {
        if (val !== undefined && val !== null) {
          opponentStats.push({ label: formatStatLabel(key), value: String(val) });
        }
      }
    }
  }

  // For Risk with multiple opponents, show all scores
  if (opponentIds.length > 1) {
    opponentStats.length = 0;
    for (const oppId of opponentIds) {
      const oppPlayer = players?.find((p) => p.sessionId === oppId);
      const name = oppPlayer?.displayName ?? `Player`;
      const score = result.scores[oppId];
      if (score !== undefined) {
        opponentStats.push({ label: name, value: `${score} ${scoreLabel.toLowerCase()}` });
      }
    }
  }

  return { localStats, opponentStats, summaryStats };
}

function formatStatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Style injection
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes vs-trophy-bounce {
      0%, 100% { transform: translateY(0); }
      20% { transform: translateY(-18px); }
      40% { transform: translateY(-8px); }
      60% { transform: translateY(-12px); }
      80% { transform: translateY(-4px); }
    }

    @keyframes vs-trophy-glow {
      0%, 100% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.1); }
      50% { box-shadow: 0 0 30px rgba(59, 130, 246, 0.5), 0 0 80px rgba(59, 130, 246, 0.2); }
    }

    @keyframes vs-fade-in {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes vs-slide-up {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .vs-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--overlay-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      animation: vs-fade-in 0.4s ease-out;
      overflow-y: auto;
      padding: var(--space-lg);
    }

    .vs-container {
      width: 100%;
      max-width: 800px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-lg);
      animation: vs-slide-up 0.5s ease-out 0.1s both;
    }

    /* Trophy */
    .vs-trophy {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      animation: vs-trophy-bounce 2s ease-in-out infinite, vs-trophy-glow 3s ease-in-out infinite;
      flex-shrink: 0;
    }

    .vs-accent-victory .vs-trophy {
      background: linear-gradient(135deg, var(--pg-blue-600), var(--pg-blue-700));
      box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
    }

    .vs-accent-defeat .vs-trophy {
      background: linear-gradient(135deg, var(--pg-slate-700), var(--pg-slate-800));
      box-shadow: 0 0 20px rgba(51, 65, 85, 0.3);
      animation: vs-trophy-bounce 2s ease-in-out infinite;
    }

    .vs-accent-draw .vs-trophy {
      background: linear-gradient(135deg, var(--pg-amber-500), var(--pg-amber-400));
      box-shadow: 0 0 20px rgba(245, 158, 11, 0.3);
      animation: vs-trophy-bounce 2s ease-in-out infinite;
    }

    /* Heading */
    .vs-heading {
      font-family: var(--font-family);
      font-size: clamp(2.5rem, 8vw, 3.5rem);
      font-weight: 800;
      color: var(--text-primary);
      text-align: center;
      line-height: 1.1;
      margin: 0;
    }

    .vs-subheading {
      font-family: var(--font-family);
      font-size: var(--font-lg);
      color: var(--text-secondary);
      text-align: center;
      margin: 0;
    }

    .vs-accent-victory .vs-subheading { color: var(--pg-blue-400); }
    .vs-accent-draw .vs-subheading { color: var(--pg-amber-400); }

    .vs-game-badge {
      display: inline-block;
      font-family: var(--font-family);
      font-size: var(--font-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      background: var(--bg-card-dark);
      padding: var(--space-2xs) var(--space-sm);
      border-radius: var(--radius-pill);
      border: 1px solid var(--border-light);
    }

    /* Stats panels */
    .vs-stats-panel {
      width: 100%;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--glass-radius);
      padding: var(--space-lg);
      box-shadow: var(--shadow-card);
    }

    .vs-stats-title {
      font-family: var(--font-family);
      font-size: var(--font-base);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 var(--space-md) 0;
    }

    .vs-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-sm);
    }

    .vs-stat-card {
      background: var(--bg-card-dark);
      border-radius: var(--radius-md);
      padding: var(--space-sm) var(--space-md);
      display: flex;
      flex-direction: column;
      gap: var(--space-2xs);
      border: 1px solid transparent;
    }

    .vs-stat-card:nth-child(4n+1) {
      background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05));
      border-color: rgba(239,68,68,0.2);
    }
    .vs-stat-card:nth-child(4n+2) {
      background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05));
      border-color: rgba(168,85,247,0.2);
    }
    .vs-stat-card:nth-child(4n+3) {
      background: linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.05));
      border-color: rgba(234,179,8,0.2);
    }
    .vs-stat-card:nth-child(4n+4) {
      background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05));
      border-color: rgba(34,197,94,0.2);
    }

    .vs-stat-icon {
      font-size: var(--font-lg);
      line-height: 1;
    }

    .vs-stat-label {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .vs-stat-value {
      font-family: var(--font-family);
      font-size: var(--font-xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    /* Player comparison */
    .vs-comparison {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-md);
    }

    @media (max-width: 480px) {
      .vs-comparison {
        grid-template-columns: 1fr;
      }
    }

    .vs-player-panel {
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 1px solid var(--glass-border);
      border-radius: var(--glass-radius);
      padding: var(--space-md);
      box-shadow: var(--shadow-card);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .vs-player-panel.vs-winner {
      border-color: var(--accent-border);
      background: linear-gradient(135deg, rgba(234,179,8,0.08), var(--glass-bg));
    }

    .vs-player-placement {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      font-weight: 700;
      color: var(--pg-amber-400);
      background: rgba(234,179,8,0.15);
      border-radius: var(--radius-pill);
      padding: 2px var(--space-xs);
      margin-left: auto;
      flex-shrink: 0;
    }

    .vs-player-header {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .vs-player-icon {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-base);
      flex-shrink: 0;
    }

    .vs-winner .vs-player-icon {
      background: var(--accent-primary);
    }

    .vs-loser .vs-player-icon {
      background: var(--pg-slate-700);
    }

    .vs-player-name {
      font-family: var(--font-family);
      font-size: var(--font-base);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .vs-player-role {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .vs-player-stats {
      display: flex;
      flex-direction: column;
      gap: var(--space-2xs);
    }

    .vs-player-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--bg-card-dark);
      border-radius: var(--radius-sm);
      padding: var(--space-2xs) var(--space-sm);
    }

    .vs-player-stat-label {
      font-family: var(--font-family);
      font-size: var(--font-xs);
      color: var(--text-muted);
      margin: 0;
    }

    .vs-player-stat-value {
      font-family: var(--font-family);
      font-size: var(--font-sm);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    /* Action buttons */
    .vs-actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .vs-btn {
      font-family: var(--font-family);
      font-size: var(--font-base);
      font-weight: 700;
      border: none;
      border-radius: var(--radius-lg);
      padding: var(--space-md) var(--space-lg);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
      width: 100%;
      text-align: center;
    }

    .vs-btn:hover {
      transform: scale(1.03);
    }

    .vs-btn:active {
      transform: scale(0.98);
    }

    .vs-btn-play-again {
      background: linear-gradient(135deg, #16a34a, #15803d);
      color: white;
      box-shadow: 0 4px 20px rgba(22, 163, 74, 0.3);
    }

    .vs-btn-play-again:hover {
      box-shadow: 0 6px 28px rgba(22, 163, 74, 0.4);
    }

    .vs-btn-lobby {
      background: var(--pg-slate-700);
      color: var(--text-primary);
    }

    .vs-btn-lobby:hover {
      background: var(--pg-slate-600);
    }

    .vs-btn-history {
      background: var(--pg-slate-700);
      color: var(--text-secondary);
      border: 1px solid var(--pg-slate-600);
    }

    .vs-btn-history:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .vs-btn-history:disabled:hover {
      transform: none;
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// VictoryScreen
// ---------------------------------------------------------------------------

export class VictoryScreen {
  private container: HTMLElement | null = null;
  private eventCallback: ((event: VictoryScreenEvent) => void) | null = null;

  show(data: VictoryScreenData, onEvent: (event: VictoryScreenEvent) => void): void {
    this.hide();
    injectStyles();

    this.eventCallback = onEvent;
    const { result, sessionId, gameType, players } = data;
    const outcome = resolveOutcome(result, sessionId);
    const winnerName = getWinnerName(result, players);
    const accentClass = resolveAccentClass(outcome);

    // Root overlay
    this.container = el("div", `vs-overlay ${accentClass}`);
    this.container.id = CONTAINER_ID;

    const inner = el("div", "vs-container");

    // Game badge
    const badge = el("span", "vs-game-badge", GAME_LABELS[gameType] ?? gameType);
    inner.appendChild(badge);

    // Trophy
    const trophy = el("div", "vs-trophy");
    trophy.textContent = resolveTrophyEmoji(outcome);
    inner.appendChild(trophy);

    // Heading
    const heading = el("h1", "vs-heading", resolveHeading(outcome, result.type));
    inner.appendChild(heading);

    // Subheading
    const sub = el("p", "vs-subheading", resolveSubheading(outcome, result, winnerName));
    inner.appendChild(sub);

    // Stats
    const { localStats, opponentStats, summaryStats } = extractPlayerStats(
      result,
      sessionId,
      gameType,
      players,
    );

    // Summary stats (duration, moves)
    if (summaryStats.length > 0) {
      inner.appendChild(this.buildStatsPanel("Game Summary", summaryStats));
    }

    // Player comparison
    if (localStats.length > 0 || opponentStats.length > 0) {
      const localName = this.resolveLocalName(sessionId, players);
      const opponentName = this.resolveOpponentName(sessionId, result, players);
      const isLocalWinner = result.winnerId === sessionId;

      // Determine placements for multi-player games
      const allPlayerIds = Object.keys(result.scores);
      const isMultiPlayer = allPlayerIds.length > 2;
      let localPlacement: number | undefined;
      let opponentPlacement: number | undefined;

      if (isMultiPlayer) {
        const sorted = [...allPlayerIds].sort(
          (a, b) => (result.scores[b] ?? 0) - (result.scores[a] ?? 0),
        );
        localPlacement = sorted.indexOf(sessionId) + 1;
        const opponentId = allPlayerIds.find((id) => id !== sessionId);
        if (opponentId) {
          opponentPlacement = sorted.indexOf(opponentId) + 1;
        }
      }

      const comparison = el("div", "vs-comparison");

      if (localStats.length > 0) {
        comparison.appendChild(
          this.buildPlayerPanel(
            localName, isLocalWinner ? "🏆" : "⚔️", localStats, isLocalWinner, localPlacement,
          ),
        );
      }

      if (opponentStats.length > 0) {
        comparison.appendChild(
          this.buildPlayerPanel(
            opponentName,
            isLocalWinner ? "⚔️" : "🏆",
            opponentStats,
            !isLocalWinner && result.type !== "draw",
            opponentPlacement,
          ),
        );
      }

      inner.appendChild(comparison);
    }

    // Action buttons
    const actions = el("div", "vs-actions");

    const playAgainBtn = el("button", "vs-btn vs-btn-play-again", "Play Again");
    playAgainBtn.addEventListener("click", () => {
      this.eventCallback?.({ type: "play_again", gameType });
    });

    const lobbyBtn = el("button", "vs-btn vs-btn-lobby", "Back to Lobby");
    lobbyBtn.addEventListener("click", () => {
      this.eventCallback?.({ type: "back_to_lobby" });
    });

    const historyBtn = el("button", "vs-btn vs-btn-history", "View History");
    historyBtn.disabled = true;
    historyBtn.title = "Coming soon";

    actions.appendChild(playAgainBtn);
    actions.appendChild(historyBtn);
    actions.appendChild(lobbyBtn);
    inner.appendChild(actions);

    this.container.appendChild(inner);
    document.body.appendChild(this.container);
  }

  hide(): void {
    if (this.container?.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
    this.container = null;
    this.eventCallback = null;
  }

  private buildStatsPanel(title: string, stats: StatEntry[]): HTMLElement {
    const panel = el("div", "vs-stats-panel");
    panel.appendChild(el("h3", "vs-stats-title", title));

    const grid = el("div", "vs-stats-grid");
    for (const stat of stats) {
      const card = el("div", "vs-stat-card");
      card.appendChild(el("span", "vs-stat-icon", statIcon(stat.label)));
      card.appendChild(el("p", "vs-stat-label", stat.label));
      card.appendChild(el("p", "vs-stat-value", stat.value));
      grid.appendChild(card);
    }

    panel.appendChild(grid);
    return panel;
  }

  private buildPlayerPanel(
    name: string,
    icon: string,
    stats: StatEntry[],
    isWinner: boolean,
    placement?: number,
  ): HTMLElement {
    const panel = el("div", `vs-player-panel ${isWinner ? "vs-winner" : "vs-loser"}`);

    const header = el("div", "vs-player-header");
    const iconEl = el("div", "vs-player-icon");
    iconEl.textContent = icon;
    header.appendChild(iconEl);

    const nameCol = el("div");
    nameCol.appendChild(el("p", "vs-player-name", name));
    nameCol.appendChild(el("p", "vs-player-role", isWinner ? "Winner" : "Opponent"));
    header.appendChild(nameCol);

    if (placement !== undefined) {
      const placementSuffix =
        placement === 1 ? "st" : placement === 2 ? "nd" : placement === 3 ? "rd" : "th";
      header.appendChild(el("span", "vs-player-placement", `${placement}${placementSuffix}`));
    }

    panel.appendChild(header);

    const statsList = el("div", "vs-player-stats");
    for (const stat of stats) {
      const row = el("div", "vs-player-stat-row");
      row.appendChild(el("span", "vs-player-stat-label", stat.label));
      row.appendChild(el("span", "vs-player-stat-value", stat.value));
      statsList.appendChild(row);
    }
    panel.appendChild(statsList);

    return panel;
  }

  private resolveLocalName(sessionId: string, players?: VictoryPlayerInfo[]): string {
    const player = players?.find((p) => p.sessionId === sessionId);
    const name = player?.displayName?.trim();
    return name ? `${name} (You)` : "You";
  }

  private resolveOpponentName(
    sessionId: string,
    result: GameResult,
    players?: VictoryPlayerInfo[],
  ): string {
    const meta = result.metadata as Record<string, unknown> | undefined;

    // For wins where we're the loser, the winner is the opponent
    if (result.winnerId && result.winnerId !== sessionId) {
      if (typeof meta?.winnerName === "string") return meta.winnerName;
      const player = players?.find((p) => p.sessionId === result.winnerId);
      if (player?.displayName?.trim()) return player.displayName.trim();
    }

    // Find any non-local player
    const opponent = players?.find((p) => p.sessionId !== sessionId);
    if (opponent?.displayName?.trim()) return opponent.displayName.trim();

    return "Opponent";
  }
}
