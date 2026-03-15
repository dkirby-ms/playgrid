export const GAME_ROOM_DISPOSED_TOPIC = "playgrid:lobby:game-room-disposed";

export interface GameRoomDisposedMessage {
  gameId: string;
  roomId: string;
}
