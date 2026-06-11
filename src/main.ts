import { App } from "./app/App";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  void App.create(app);
}
