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

import {
  installNativeApiFetchBridge,
} from "@/lib/api";

/*
 * Install the API bridge before React renders.
 *
 * Website:
 * No change. Requests such as /api/finnhub continue
 * using the current Vercel origin.
 *
 * Capacitor iOS:
 * /api requests are automatically routed through:
 * https://stock-pulse-rouge.vercel.app
 */
installNativeApiFetchBridge();

initTheme();

/*
 * On web this immediately does nothing.
 * Inside the Capacitor iOS app it starts listening
 * for OAuth and password-reset deep links.
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
