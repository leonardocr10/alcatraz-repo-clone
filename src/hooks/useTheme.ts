import { useEffect, useState } from "react";

export interface ThemeColors {
  primary: string; // HSL values like "0 70% 45%"
  gold: string;
  border: string;
}

const THEME_KEY = "roleta-war-theme";

const PRESET_THEMES: { name: string; colors: ThemeColors }[] = [
  {
    name: "Vermelho (Padrão)",
    colors: { primary: "0 70% 45%", gold: "40 80% 55%", border: "0 40% 25%" },
  },
  {
    name: "Azul Gelo",
    colors: { primary: "210 70% 50%", gold: "40 80% 55%", border: "210 40% 25%" },
  },
  {
    name: "Verde Veneno",
    colors: { primary: "140 70% 40%", gold: "40 80% 55%", border: "140 40% 25%" },
  },
  {
    name: "Roxo Arcano",
    colors: { primary: "270 70% 50%", gold: "40 80% 55%", border: "270 40% 25%" },
  },
  {
    name: "Laranja Fogo",
    colors: { primary: "25 90% 50%", gold: "40 80% 55%", border: "25 40% 25%" },
  },
  {
    name: "Dourado Imperial",
    colors: { primary: "40 80% 50%", gold: "40 90% 60%", border: "40 40% 25%" },
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
