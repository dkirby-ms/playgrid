import { BackgammonRenderer } from "./BackgammonRenderer";
import { CheckersRenderer } from "./CheckersRenderer";
import { rendererRegistry } from "./RendererRegistry";

rendererRegistry.register("checkers", () => new CheckersRenderer());
rendererRegistry.register("backgammon", () => new BackgammonRenderer());

export type { GameRenderer, RendererInputEvent } from "./GameRenderer";
export { BackgammonRenderer } from "./BackgammonRenderer";
export { CheckersRenderer } from "./CheckersRenderer";
export { RendererRegistry, rendererRegistry } from "./RendererRegistry";
export type { GameRendererFactory } from "./RendererRegistry";
