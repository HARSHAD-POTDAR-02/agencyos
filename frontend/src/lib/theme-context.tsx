"use client";

import React, { createContext, Suspense, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  mounted: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function MarketingRouteSync({
  theme,
  applyAppTheme,
}: {
  theme: Theme;
  applyAppTheme: (t: Theme) => void;
}) {
  const pathname = usePathname();
  const isMarketing = pathname === "/";

  useEffect(() => {
    if (isMarketing) {
      const root = document.documentElement;
      root.setAttribute("data-marketing", "true");
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    } else {
      applyAppTheme(theme);
    }
  }, [isMarketing, theme, applyAppTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  const applyAppTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.removeAttribute("data-marketing");
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.classList.add("light");
      root.style.colorScheme = "light";
    }
  };

  useEffect(() => {
    let activeTheme: Theme = "dark";
    try {
      const savedTheme = localStorage.getItem("agencyos-theme") as Theme | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        activeTheme = savedTheme;
      }
    } catch {
      // Fallback to dark default
    }
    setThemeState(activeTheme);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    const isMarketing = typeof window !== "undefined" && window.location.pathname === "/";
    if (!isMarketing) {
      applyAppTheme(newTheme);
    }
    try {
      localStorage.setItem("agencyos-theme", newTheme);
    } catch (e) {
      console.error("Failed to save theme in localStorage:", e);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, mounted, toggleTheme, setTheme }}>
      <Suspense fallback={null}>
        <MarketingRouteSync theme={theme} applyAppTheme={applyAppTheme} />
      </Suspense>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
