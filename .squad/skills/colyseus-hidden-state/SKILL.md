# Skill: Hidden State in Colyseus Games

## When to use
When implementing a game with hidden information (card games, dominos, etc.) where some state must never reach certain clients.

## Pattern

### Server-only data outside the schema
Store truly secret data (boneyard tiles, deck contents) in a server-side `Map<TState, T>` keyed by the state instance — NOT in the Colyseus schema. This guarantees the data is never serialized to any client regardless of transport-layer filtering.

```typescript
const boneyards = new Map<DominosState, RawTile[]>();

function getBoneyard(state: DominosState): RawTile[] {
  return boneyards.get(state) ?? [];
}

function setBoneyard(state: DominosState, tiles: RawTile[]): void {
  boneyards.set(state, tiles);
  state.boneyardCount = tiles.length; // public count only
}
```

### Schema fields for public metadata
Expose counts or boolean flags in the schema so clients know something exists without seeing the contents:
- `boneyardCount: number` — how many tiles remain
- `hand: ArraySchema<Tile>` — visible to the owning player's client

### Cleanup
Always clear server-side maps in the `onGameEnd` lifecycle hook to prevent memory leaks:
```typescript
onGameEnd(state) {
  state.phase = "ended";
  clearBoneyard(state);
}
```

## References
- `server/src/games/dominos/DominosPlugin.ts` — boneyard implementation
- `shared/src/gamePlugin.ts` — `StateFilter` interface for per-client filtering
