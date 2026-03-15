export const JOIN_GAME_QUERY_PARAM = "join";

function normalizeGameId(gameId: string | null | undefined): string | null {
  const normalizedGameId = gameId?.trim();
  return normalizedGameId ? normalizedGameId : null;
}

export function getJoinGameIdFromHref(href: string): string | null {
  const url = new URL(href, "http://localhost");
  return normalizeGameId(url.searchParams.get(JOIN_GAME_QUERY_PARAM));
}

export function buildJoinGameHref(href: string, gameId: string): string {
  const url = new URL(href, "http://localhost");
  const normalizedGameId = normalizeGameId(gameId);

  if (!normalizedGameId) {
    url.searchParams.delete(JOIN_GAME_QUERY_PARAM);
    return url.toString();
  }

  url.searchParams.set(JOIN_GAME_QUERY_PARAM, normalizedGameId);
  return url.toString();
}

export function clearJoinGameHref(href: string): string {
  const url = new URL(href, "http://localhost");
  url.searchParams.delete(JOIN_GAME_QUERY_PARAM);
  return url.toString();
}
