import { useEffect, useState } from "react";

export interface ThemeColors {
  primary: string;
  gold: string;
  border: string;
}

const THEME_KEY = "roleta-war-theme";

const PRESET_THEMES: { name: string; colors: ThemeColors }[] = [
  {
    name: "Dourado",
    colors: { primary: "35 90% 55%", gold: "40 85% 58%", border: "220 14% 20%" },
  },
  {
    name: "Azul Gelo",
    colors: { primary: "200 70% 50%", gold: "40 85% 58%", border: "210 14% 20%" },
  },
  {
    name: "Ciano (Padrão)",
    colors: { primary: "190 85% 48%", gold: "40 85% 58%", border: "210 14% 20%" },
  },
  {
    name: "Vermelho",
    colors: { primary: "0 70% 50%", gold: "40 85% 58%", border: "0 20% 20%" },
  },
  {
    name: "Verde",
    colors: { primary: "140 70% 40%", gold: "40 85% 58%", border: "140 20% 20%" },
  },
  {
    name: "Roxo",
    colors: { primary: "270 70% 55%", gold: "40 85% 58%", border: "270 20% 20%" },
  },
];

function applyTheme(colors: ThemeColors) {
  const root = document.documentElement;
  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--ring", colors.primary);
  root.style.setProperty("--sidebar-primary", colors.primary);
  root.style.setProperty("--sidebar-ring", colors.primary);
  root.style.setProperty("--gold", colors.gold);
  root.style.setProperty("--border", colors.border);
}

export function loadSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      const colors: ThemeColors = JSON.parse(saved);
      applyTheme(colors);
    }
  } catch {}
}

export function useTheme() {
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return PRESET_THEMES[0].colors;
  });

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const setTheme = (colors: ThemeColors) => {
    setCurrentTheme(colors);
    applyTheme(colors);
    localStorage.setItem(THEME_KEY, JSON.stringify(colors));
  };

  const resetTheme = () => {
    const defaults = PRESET_THEMES[0].colors;
    setCurrentTheme(defaults);
    applyTheme(defaults);
    localStorage.removeItem(THEME_KEY);
  };

  return { currentTheme, setTheme, resetTheme, presets: PRESET_THEMES };
}
