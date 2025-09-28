import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// --- Import the ThemeProvider ---
// This is the component that will manage our light/dark mode.
import { ThemeProvider } from "@/components/ThemeProvider"
import { ThemeToggle } from "@/components/ThemeToggle"
// This is the root of our entire React application.
// It finds the <div id="root"> in index.html and renders our app inside it.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* --- Wrap your entire app in the ThemeProvider --- */}
    {/* This makes the theme (and the ability to change it) available to all components. */}
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)

