import { PlaygridApp } from "./Application";

declare global {
  interface Window {
    __PLAYGRID_E2E__?: {
      app: PlaygridApp;
    };
  }
}

const app = new PlaygridApp();

if (new URLSearchParams(window.location.search).has("e2e")) {
  window.__PLAYGRID_E2E__ = { app };
}

app.init(document.getElementById("app")!).catch((error) => {
  console.error(error);
});
