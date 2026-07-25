import React from "react";
import ReactDOM from "react-dom/client";

import App from "@/App.jsx";
import "@/index.css";

import {
  initTheme,
} from "@/components/settings/ThemeSection.jsx";

import {
  initializeNativeAuth,
} from "@/lib/mobileAuth";

initTheme();

/*
 * On web this immediately does nothing.
 * Inside Capacitor iOS it listens for
 * OAuth and password-reset deep links.
 */
initializeNativeAuth().catch(
  (error) => {
    console.error(
      "Failed to initialize native authentication:",
      error,
    );
  },
);

ReactDOM.createRoot(
  document.getElementById("root"),
).render(
  <App />,
);
