import { CheckersRenderer } from "./CheckersRenderer";
import { rendererRegistry } from "./RendererRegistry";

rendererRegistry.register("checkers", () => new CheckersRenderer());

export type { GameRenderer, RendererInputEvent } from "./GameRenderer";
export { CheckersRenderer } from "./CheckersRenderer";
export { RendererRegistry, rendererRegistry } from "./RendererRegistry";
export type { GameRendererFactory } from "./RendererRegistry";
