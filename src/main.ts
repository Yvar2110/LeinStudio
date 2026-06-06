import { StudioApp } from "./app/StudioApp";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  new StudioApp(app);
}
