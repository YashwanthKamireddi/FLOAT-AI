// This component provides the theme (light/dark) to your entire application.

import { createContext, useContext, useEffect, useState } from "react"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: "dark" | "light" | "system"
  storageKey?: string
}

type ThemeProviderState = {
  theme: "dark" | "light" | "system"
  setTheme: (theme: "dark" | "light" | "system") => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const resolveInitialTheme = () => {
    if (typeof window === "undefined") {
      return defaultTheme
    }

    try {
      const storedTheme = window.localStorage?.getItem(storageKey) as "dark" | "light" | "system" | null
      return storedTheme ?? defaultTheme
    } catch (error) {
      console.warn("ThemeProvider: unable to access localStorage, falling back to default theme.", error)
      return defaultTheme
    }
  }

  const [theme, setTheme] = useState<"dark" | "light" | "system">(resolveInitialTheme)

  useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const root = document.documentElement
    root.classList.remove("light", "dark")
    if (theme === "system") {
      const systemTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.add(systemTheme)
      return
    }
    root.classList.add(theme)
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: "dark" | "light" | "system") => {
      try {
        if (typeof window !== "undefined") {
          window.localStorage?.setItem(storageKey, theme)
        }
      } catch (error) {
        console.warn("ThemeProvider: unable to persist theme selection.", error)
      }
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")
  return context
}
