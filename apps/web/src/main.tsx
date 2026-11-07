import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "./router";
import { createSession } from "./lib/session";
import { SessionContext } from "./lib/app-context";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-600.css";
import "./styles.css";
const session = createSession();
const router = createAppRouter(session);
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SessionContext.Provider value={session}>
      <QueryClientProvider client={session.queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </SessionContext.Provider>
  </React.StrictMode>,
);
