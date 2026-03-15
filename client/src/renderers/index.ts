import { BackgammonRenderer } from "./BackgammonRenderer";
import { CheckersRenderer } from "./CheckersRenderer";
import { RiskRenderer } from "./RiskRenderer";
import { rendererRegistry } from "./RendererRegistry";

rendererRegistry.register("checkers", () => new CheckersRenderer());
rendererRegistry.register("backgammon", () => new BackgammonRenderer());
rendererRegistry.register("risk", () => new RiskRenderer());

export type { GameRenderer, RendererInputEvent } from "./GameRenderer";
export { BackgammonRenderer } from "./BackgammonRenderer";
export { CheckersRenderer } from "./CheckersRenderer";
export { RiskRenderer } from "./RiskRenderer";
export { RendererRegistry, rendererRegistry } from "./RendererRegistry";
export type { GameRendererFactory } from "./RendererRegistry";
