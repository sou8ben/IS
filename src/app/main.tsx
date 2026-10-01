import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { unstableSetRender } from "antd-mobile";
import { MobileApp } from "./App";
import { DemoHost } from "./demo";
import "./app.css";

// antd-mobile 的 Toast、Dialog 等命令式 API 在 React 19 需指定 render 函數
unstableSetRender((node, container) => {
  const target = container as (Element | DocumentFragment) & { _reactRoot?: Root };
  target._reactRoot ??= createRoot(target);
  const root = target._reactRoot;
  root.render(node);
  return async () => { await new Promise((resolve) => setTimeout(resolve, 0)); root.unmount(); delete target._reactRoot; };
});

const embedded = new URLSearchParams(window.location.search).has("embed") || window.self !== window.top;
const showHost = !embedded && window.matchMedia("(min-width: 640px)").matches;
document.documentElement.classList.add(showHost ? "is-host" : "is-mobile");

createRoot(document.getElementById("root")!).render(<React.StrictMode>{showHost ? <DemoHost /> : <MobileApp />}</React.StrictMode>);
