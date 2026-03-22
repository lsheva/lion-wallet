import { render } from "solid-js/web";
import { App } from "./App";
import "./styles/globals.css";

const savedTheme = localStorage.getItem("lion-theme");
if (savedTheme === "dark" || savedTheme === "light") {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

const root = document.getElementById("app");
if (root) render(() => <App />, root);
