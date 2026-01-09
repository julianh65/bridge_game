import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";

import App from "./App";
import "./styles.css";

// Initialize Vercel Web Analytics
inject();

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
