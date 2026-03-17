import { BackgammonRenderer } from "./BackgammonRenderer";
import { CheckersRenderer } from "./CheckersRenderer";
import { DominosRenderer } from "./DominosRenderer";
import { RiskRenderer } from "./RiskRenderer";
import { rendererRegistry } from "./RendererRegistry";

rendererRegistry.register("checkers", () => new CheckersRenderer());
rendererRegistry.register("backgammon", () => new BackgammonRenderer());
rendererRegistry.register("risk", () => new RiskRenderer());
rendererRegistry.register("dominos", () => new DominosRenderer());

export type { GameRenderer, GameRendererHUDStatus, RendererInputEvent } from "./GameRenderer";
export { BackgammonRenderer } from "./BackgammonRenderer";
export { CheckersRenderer } from "./CheckersRenderer";
export { DominosRenderer } from "./DominosRenderer";
export { RiskRenderer } from "./RiskRenderer";
export { RendererRegistry, rendererRegistry } from "./RendererRegistry";
export type { GameRendererFactory } from "./RendererRegistry";
