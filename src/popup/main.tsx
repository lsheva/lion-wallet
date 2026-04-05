import { render } from "solid-js/web";
import { App } from "./App";
import { registerDevBackgroundServiceWorker } from "./register-dev-sw";
import "./styles/globals.css";

const savedTheme = localStorage.getItem("lion-theme");
if (savedTheme === "dark" || savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_MOCK !== "true") {
    await registerDevBackgroundServiceWorker();
  }

  const root = document.getElementById("app");
  if (root) render(() => <App />, root);
}

void start();
