import React, { useState } from "react";

export const THEMES = [
  {
    id: "default",
    label: "Default",
    swatch: "#0a0a0a",
    vars: null, // uses CSS defaults
  },
  {
    id: "blue",
    label: "Ocean",
    swatch: "#4f7ec4",
    vars: {
      "--primary": "221 60% 45%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "221 60% 45%",
      "--background": "214 40% 98%",
      "--foreground": "221 39% 11%",
      "--card": "214 30% 99%",
      "--card-foreground": "221 39% 11%",
      "--muted": "214 20% 95%",
      "--muted-foreground": "221 15% 45%",
      "--accent": "214 30% 94%",
      "--accent-foreground": "221 39% 11%",
      "--border": "214 15% 91%",
      "--input": "214 15% 91%",
      "--secondary": "214 20% 95%",
      "--secondary-foreground": "221 39% 11%",
    },
    darkVars: {
      "--primary": "221 60% 60%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "221 83% 60%",
      "--background": "221 30% 8%",
      "--foreground": "214 80% 92%",
      "--card": "221 28% 12%",
      "--card-foreground": "214 80% 92%",
      "--muted": "221 25% 18%",
      "--muted-foreground": "214 30% 60%",
      "--accent": "221 25% 18%",
      "--accent-foreground": "214 80% 92%",
      "--border": "221 22% 22%",
      "--input": "221 22% 22%",
      "--secondary": "221 25% 18%",
      "--secondary-foreground": "214 80% 92%",
    },
  },
  {
    id: "green",
    label: "Forest",
    swatch: "#5a9e74",
    vars: {
      "--primary": "142 45% 38%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "142 45% 38%",
      "--background": "138 25% 98%",
      "--foreground": "140 40% 10%",
      "--card": "138 15% 99%",
      "--card-foreground": "140 40% 10%",
      "--muted": "138 12% 95%",
      "--muted-foreground": "140 12% 42%",
      "--accent": "138 15% 94%",
      "--accent-foreground": "140 40% 10%",
      "--border": "138 10% 91%",
      "--input": "138 10% 91%",
      "--secondary": "138 12% 95%",
      "--secondary-foreground": "140 40% 10%",
    },
    darkVars: {
      "--primary": "142 40% 50%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "142 72% 40%",
      "--background": "140 20% 8%",
      "--foreground": "138 60% 90%",
      "--card": "140 18% 12%",
      "--card-foreground": "138 60% 90%",
      "--muted": "140 16% 18%",
      "--muted-foreground": "138 20% 58%",
      "--accent": "140 16% 18%",
      "--accent-foreground": "138 60% 90%",
      "--border": "140 14% 22%",
      "--input": "140 14% 22%",
      "--secondary": "140 16% 18%",
      "--secondary-foreground": "138 60% 90%",
    },
  },
  {
    id: "purple",
    label: "Violet",
    swatch: "#8b72c4",
    vars: {
      "--primary": "262 50% 50%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "262 50% 50%",
      "--background": "258 30% 98%",
      "--foreground": "262 40% 10%",
      "--card": "258 20% 99%",
      "--card-foreground": "262 40% 10%",
      "--muted": "258 12% 95%",
      "--muted-foreground": "262 12% 44%",
      "--accent": "258 18% 94%",
      "--accent-foreground": "262 40% 10%",
      "--border": "258 10% 91%",
      "--input": "258 10% 91%",
      "--secondary": "258 12% 95%",
      "--secondary-foreground": "262 40% 10%",
    },
    darkVars: {
      "--primary": "262 50% 65%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "262 83% 65%",
      "--background": "262 25% 8%",
      "--foreground": "258 70% 92%",
      "--card": "262 22% 12%",
      "--card-foreground": "258 70% 92%",
      "--muted": "262 20% 18%",
      "--muted-foreground": "258 25% 60%",
      "--accent": "262 20% 18%",
      "--accent-foreground": "258 70% 92%",
      "--border": "262 18% 22%",
      "--input": "262 18% 22%",
      "--secondary": "262 20% 18%",
      "--secondary-foreground": "258 70% 92%",
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#c47a8a",
    vars: {
      "--primary": "347 45% 48%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "347 45% 48%",
      "--background": "350 30% 98%",
      "--foreground": "347 40% 10%",
      "--card": "350 20% 99%",
      "--card-foreground": "347 40% 10%",
      "--muted": "350 12% 95%",
      "--muted-foreground": "347 12% 44%",
      "--accent": "350 18% 94%",
      "--accent-foreground": "347 40% 10%",
      "--border": "350 10% 91%",
      "--input": "350 10% 91%",
      "--secondary": "350 12% 95%",
      "--secondary-foreground": "347 40% 10%",
    },
    darkVars: {
      "--primary": "347 50% 62%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "347 77% 60%",
      "--background": "347 22% 8%",
      "--foreground": "350 70% 92%",
      "--card": "347 20% 12%",
      "--card-foreground": "350 70% 92%",
      "--muted": "347 18% 18%",
      "--muted-foreground": "350 22% 58%",
      "--accent": "347 18% 18%",
      "--accent-foreground": "350 70% 92%",
      "--border": "347 16% 22%",
      "--input": "347 16% 22%",
      "--secondary": "347 18% 18%",
      "--secondary-foreground": "350 70% 92%",
    },
  },
  {
    id: "orange",
    label: "Amber",
    swatch: "#c49060",
    vars: {
      "--primary": "28 55% 45%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "28 55% 45%",
      "--background": "30 30% 98%",
      "--foreground": "20 40% 10%",
      "--card": "30 20% 99%",
      "--card-foreground": "20 40% 10%",
      "--muted": "30 12% 95%",
      "--muted-foreground": "20 12% 44%",
      "--accent": "30 18% 94%",
      "--accent-foreground": "20 40% 10%",
      "--border": "30 10% 91%",
      "--input": "30 10% 91%",
      "--secondary": "30 12% 95%",
      "--secondary-foreground": "20 40% 10%",
    },
    darkVars: {
      "--primary": "28 55% 60%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "20 90% 52%",
      "--background": "20 22% 8%",
      "--foreground": "30 70% 92%",
      "--card": "20 20% 12%",
      "--card-foreground": "30 70% 92%",
      "--muted": "20 18% 18%",
      "--muted-foreground": "30 22% 58%",
      "--accent": "20 18% 18%",
      "--accent-foreground": "30 70% 92%",
      "--border": "20 16% 22%",
      "--input": "20 16% 22%",
      "--secondary": "20 18% 18%",
      "--secondary-foreground": "30 70% 92%",
    },
  },
];

const DEFAULT_VARS = {
  "--primary": "0 0% 9%",
  "--primary-foreground": "0 0% 98%",
  "--ring": "0 0% 3.9%",
  "--background": "0 0% 100%",
  "--foreground": "0 0% 3.9%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 3.9%",
  "--muted": "0 0% 96.1%",
  "--muted-foreground": "0 0% 45.1%",
  "--accent": "0 0% 96.1%",
  "--accent-foreground": "0 0% 9%",
  "--border": "0 0% 89.8%",
  "--input": "0 0% 89.8%",
  "--secondary": "0 0% 96.1%",
  "--secondary-foreground": "0 0% 9%",
};

let _systemDarkListener = null;

function detachSystemDarkListener() {
  if (_systemDarkListener) {
    window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", _systemDarkListener);
    _systemDarkListener = null;
  }
  document.documentElement.classList.remove("dark");
}

export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;

  detachSystemDarkListener();
  const vars = {
    ...DEFAULT_VARS,
    ...(theme.vars || {}),
  };

  vars["--popover"] = vars["--card"];
  vars["--popover-foreground"] = vars["--card-foreground"];

  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.stockpulseTheme = theme.id;

  localStorage.setItem("stockpulse-theme", themeId);
}

export function initTheme() {
  const saved = localStorage.getItem("stockpulse-theme") || "default";
  applyTheme(saved);
}

export default function ThemeSection() {
  const [selected, setSelected] = useState(() => localStorage.getItem("stockpulse-theme") || "default");

  const handleSelect = (id) => {
    setSelected(id);
    applyTheme(id);
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 px-1">Appearance</p>
      <div className="border border-gray-100 rounded-2xl px-5 py-4" style={{ backgroundColor: "hsl(var(--card))" }}>
        <p className="text-sm font-medium text-gray-900 mb-3">Colour Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleSelect(theme.id)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all ${selected === theme.id ? "border-gray-900" : "border-transparent hover:border-gray-200"}`}
            >
              <div
                className="w-8 h-8 rounded-full border border-black/10"
                style={{ background: theme.swatch }}
              />
              <span className="text-xs text-gray-500 font-medium">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
