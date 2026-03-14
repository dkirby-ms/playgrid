import { PlaygridApp } from "./Application";

const app = new PlaygridApp();

app.init(document.getElementById("app")!).catch((error) => {
  console.error(error);
});
