import { Application, Text } from "pixi.js";
import { Client, type Room } from "@colyseus/sdk";
import { LobbyScreen } from "./ui/LobbyScreen";
import { WaitingRoom } from "./ui/WaitingRoom";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const LOBBY_ROOM_NAME = "lobby";

type ColyseusRoom = Room<Record<string, unknown>>;

function getServerUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${protocol}://${host}:2567`;
}

function createStatusText(app: Application): Text {
  const statusText = new Text({
    text: "Connecting to lobby…",
    style: {
      fontFamily: "monospace",
      fontSize: 18,
      fill: 0xffffff,
    },
  });

  statusText.anchor.set(0.5);
  app.stage.addChild(statusText);
  app.ticker.add(() => {
    statusText.x = app.screen.width / 2;
    statusText.y = app.screen.height / 2;
  });

  return statusText;
}

async function main() {
  const gameContainer = document.getElementById("game-container");
  if (!gameContainer) {
    throw new Error("Missing #game-container");
  }

  const app = new Application();
  await app.init({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x1a1a2e,
    resizeTo: gameContainer,
  });

  gameContainer.appendChild(app.canvas);

  const statusText = createStatusText(app);
  const client = new Client(getServerUrl());
  const lobbyScreen = new LobbyScreen();
  const waitingRoom = new WaitingRoom();

  let lobbyRoom: ColyseusRoom | null = null;
  let gameRoom: ColyseusRoom | null = null;

  const showLobby = (notice?: { message: string; tone: "info" | "error" }) => {
    waitingRoom.hide();
    lobbyScreen.show();

    if (notice) {
      lobbyScreen.showNotice(notice.message, notice.tone);
    } else {
      lobbyScreen.clearNotice();
    }

    statusText.text = lobbyRoom
      ? "Lobby connected — create or join a game."
      : "Connecting to lobby…";
  };

  const bindGameRoom = (room: ColyseusRoom) => {
    room.onStateChange((state) => {
      console.log("[playgrid] State updated:", state);
    });

    room.onLeave((code) => {
      if (gameRoom?.id !== room.id) {
        return;
      }

      console.log(`[playgrid] Left game room ${room.id} (code: ${code})`);
      gameRoom = null;
      showLobby({ message: "Game room closed. Back in the lobby.", tone: "info" });
    });

    room.onError((code, message) => {
      if (gameRoom?.id !== room.id) {
        return;
      }

      console.error(`[playgrid] Game room error ${code}: ${message}`);
      statusText.text = `Game error: ${message}`;
      lobbyScreen.showNotice(message, "error");
    });
  };

  const joinGameRoom = async (roomId: string) => {
    statusText.text = "Joining game room…";

    try {
      const room = (await client.joinById(roomId)) as ColyseusRoom;
      gameRoom = room;
      lobbyScreen.hide();
      waitingRoom.hide();
      bindGameRoom(room);
      statusText.text = `Connected — Room: ${room.id}`;
      console.log(`[playgrid] Joined game room: ${room.id}`);
    } catch (error) {
      console.error("[playgrid] Failed to join game room:", error);
      gameRoom = null;
      showLobby({ message: "Could not join that game room.", tone: "error" });
    }
  };

  waitingRoom.onEvent(async (event) => {
    if (event.type === "leave") {
      showLobby({ message: "Returned to the lobby browser.", tone: "info" });
      return;
    }

    await joinGameRoom(event.roomId);
  });

  lobbyScreen.onEvent(async (event) => {
    if (event.type === "error") {
      statusText.text = event.message;
      return;
    }

    if (event.type === "waiting") {
      if (!lobbyRoom) {
        lobbyScreen.showConnectionError("Lobby room is unavailable.");
        return;
      }

      lobbyScreen.hide();
      waitingRoom.show(lobbyRoom, event.gameId, event.gameInfo, event.isHost);
      statusText.text = `Waiting room — ${event.gameInfo?.name ?? "Game"}`;
      return;
    }

    await joinGameRoom(event.roomId);
  });

  try {
    statusText.text = "Connecting to lobby…";
    lobbyRoom = (await client.joinOrCreate(LOBBY_ROOM_NAME)) as ColyseusRoom;
    lobbyScreen.bindToRoom(lobbyRoom);
    showLobby();
    console.log(`[playgrid] Joined lobby room: ${lobbyRoom.id}`);

    lobbyRoom.onLeave((code) => {
      console.log(`[playgrid] Left lobby room (code: ${code})`);
      lobbyRoom = null;
      waitingRoom.hide();
      lobbyScreen.showConnectionError("Lost connection to the lobby room.");
      statusText.text = "Lobby disconnected.";
    });

    lobbyRoom.onError((code, message) => {
      console.error(`[playgrid] Lobby error ${code}: ${message}`);
      statusText.text = `Lobby error: ${message}`;
      lobbyScreen.showNotice(message, "error");
    });
  } catch (error) {
    console.error("[playgrid] Lobby connection failed:", error);
    const message = error instanceof Error ? error.message : "Connection failed — is the server running?";
    statusText.text = "Connection failed — is the server running?";
    lobbyScreen.showConnectionError(message);
  }
}

main().catch((error) => {
  console.error(error);
});
