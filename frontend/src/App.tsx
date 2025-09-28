// This is the main orchestrator for your entire frontend application.
// It replaces the functionality of the original FloatChatDashboard.tsx.

import { useState, useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import { Compass, CalendarDays, Database } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import DataVisualization from "@/components/DataVisualization";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { askAI } from "@/services/api";

export interface AppData {
  data: Record<string, any>[];
  sqlQuery: string;
}

function App() {
  const [appData, setAppData] = useState<AppData>({ data: [], sqlQuery: "" });
  const [isLoading, setIsLoading] = useState(true); // For the initial welcome map

  useEffect(() => {
    const fetchInitialData = async () => {
      const initialQuestion = "Show me the location of 100 recent floats.";
      console.log("Fetching initial data for welcome map...");
      const response = await askAI(initialQuestion);

      if (response && !response.error && Array.isArray(response.result_data) && response.sql_query) {
        setAppData({ data: response.result_data, sqlQuery: response.sql_query });
      }
      setIsLoading(false);
    };

    fetchInitialData();
  }, []);

  const oceanMetrics = useMemo(() => {
    if (!appData.data.length) {
      return {
        totalRecords: "Waiting for data",
        uniqueFloats: "—",
        lastObservation: "—",
      };
    }

    const totalRecords = appData.data.length.toLocaleString();
    const uniqueFloats = new Set(
      appData.data
        .map((row) => row.float_id)
        .filter((id) => id !== undefined && id !== null)
    ).size;

    const mostRecentDate = appData.data
      .map((row) => row.profile_date || row.date || row.observation_date)
      .map((value) => {
        const parsed = value ? new Date(value) : null;
        return parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
      })
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      totalRecords,
      uniqueFloats: uniqueFloats ? uniqueFloats.toLocaleString() : "—",
      lastObservation: mostRecentDate
        ? mostRecentDate.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    };
  }, [appData.data]);
  const handleDataReceived = (data: Record<string, any>[], sqlQuery: string) => {
    setAppData({ data, sqlQuery });
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <div className="relative min-h-screen w-full overflow-hidden bg-ocean-gradient">
        <div className="pointer-events-none absolute inset-0 grid-overlay opacity-30" />
        <div className="pointer-events-none absolute -top-40 -left-32 h-96 w-96 rounded-full gradient-ring blur-3xl opacity-40" />
        <div className="pointer-events-none absolute -bottom-48 right-0 h-[420px] w-[420px] rounded-full gradient-ring blur-3xl opacity-30" />

        <main className="relative z-10 flex min-h-screen flex-col">
          <header className="mx-auto w-full max-w-7xl px-6 pt-12 pb-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 shadow-sm dark:bg-white/10 dark:text-sky-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Ocean Intelligence
                </div>
                <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl dark:text-slate-100">
                  FloatChat
                </h1>
                <p className="mt-3 max-w-2xl text-base text-slate-600 dark:text-slate-300">
                  Explore 53,000+ ARGO float profiles with conversational search, instant visualizations, and science-ready SQL at your fingertips.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start rounded-full bg-white/70 p-2 shadow-sm backdrop-blur lg:self-auto dark:bg-white/5">
                <div className="hidden flex-col text-xs font-medium text-slate-500 dark:text-slate-300 sm:flex">
                  <span>Adaptive theme</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-100">Day / Night ready</span>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={Database}
                label="Records analysed"
                value={oceanMetrics.totalRecords}
                helper="Latest AI data pull"
              />
              <StatCard
                icon={Compass}
                label="Active floats"
                value={oceanMetrics.uniqueFloats}
                helper="Distinct float IDs in view"
              />
              <StatCard
                icon={CalendarDays}
                label="Most recent profile"
                value={oceanMetrics.lastObservation}
                helper="Timestamp of newest measurement"
              />
            </div>
          </header>

          <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pb-12">
            <div className="grid flex-1 gap-6 pb-4 lg:grid-cols-[400px,minmax(0,1fr)] xl:grid-cols-[420px,minmax(0,1fr)]">
              <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/40 glass-panel">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-32 translate-x-16 bg-gradient-to-l from-white/40 to-transparent blur-3xl opacity-40 dark:from-cyan-500/10" />
                <ChatInterface onDataReceived={handleDataReceived} />
              </div>

              <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-3xl border border-white/40 glass-panel">
                {isLoading ? (
                  <div className="flex flex-1 flex-col justify-center gap-6 p-10">
                    <LoadingPanel />
                  </div>
                ) : (
                  <DataVisualization data={appData.data} sqlQuery={appData.sqlQuery} />
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </ThemeProvider>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
}

const StatCard = ({ icon: Icon, label, value, helper }: StatCardProps) => (
  <div className="glass-panel relative flex items-center gap-4 rounded-2xl border border-white/30 px-5 py-4">
    <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-gradient-ocean text-white shadow-lg shadow-sky-500/30">
      <Icon className="h-6 w-6" />
      <div className="pointer-events-none absolute inset-0 bg-white/35 mix-blend-overlay" />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-300">{helper}</p>
    </div>
  </div>
);

const LoadingPanel = () => (
  <div className="grid gap-5">
    <div className="space-y-3">
      <div className="h-4 w-40 rounded-full bg-white/60 dark:bg-white/10" />
      <div className="h-6 w-64 rounded-full bg-white/70 dark:bg-white/10" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="h-28 rounded-2xl border border-white/40 bg-white/60 backdrop-blur dark:border-white/10 dark:bg-white/5" />
      <div className="h-28 rounded-2xl border border-white/40 bg-white/60 backdrop-blur dark:border-white/10 dark:bg-white/5" />
    </div>
    <div className="h-64 rounded-3xl border border-white/40 bg-white/50 backdrop-blur dark:border-white/10 dark:bg-white/5" />
  </div>
);

export default App;

