// This is the main orchestrator for your entire frontend application.
// It replaces the functionality of the original FloatChatDashboard.tsx.

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { Compass, CalendarDays, Database } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";
import DataVisualization from "@/components/DataVisualization";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { askAI } from "@/services/api";
import CommandPalette from "@/components/CommandPalette";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ErrorBoundary";

export interface AppData {
  data: Record<string, any>[];
  sqlQuery: string;
}

type PersonaMode = "guided" | "expert";

interface DataSynopsis {
  signature: string;
  headline: string;
  highlights: string[];
  columns: string[];
  sampleFloat?: string;
  dateWindow?: { start: string | null; end: string | null };
}

interface ExpertFilters {
  focusMetric: "temperature" | "salinity" | "pressure" | "oxygen" | "density";
  floatId?: string;
  depthRange?: [number | null, number | null];
}

const COMPLEXITY_THRESHOLD = 4;

const GUIDED_EXAMPLES = [
  "Where are the newest floats deployed this month?",
  "Compare temperature and salinity for float 2902273 at 1000 dbar.",
  "Summarize oxygen levels for floats in the North Atlantic.",
  "Explain the recent trends in mixed layer depth near 45°N, 30°W.",
];

type BackendStatus = "operational" | "degraded" | "offline";

const BACKEND_STATUS_MAP: Record<BackendStatus, { label: string; description: string; indicatorClass: string; pillClass: string }> = {
  operational: {
    label: "Operational",
    description: "All systems nominal.",
    indicatorClass: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
    pillClass: "bg-white/60 dark:bg-white/10",
  },
  degraded: {
    label: "Degraded",
    description: "Serving cached insights while the backend stabilizes.",
    indicatorClass: "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)]",
    pillClass: "bg-amber-50/90 dark:bg-amber-500/10",
  },
  offline: {
    label: "Offline",
    description: "Backend unreachable — verify the Python API server.",
    indicatorClass: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]",
    pillClass: "bg-rose-50/90 dark:bg-rose-500/10",
  },
};

const WELCOME_CACHE_KEY = "floatchat::welcome-cache::v1";

const createDataSynopsis = (data: Record<string, any>[]): DataSynopsis | null => {
  if (!data.length) return null;

  const columns = Object.keys(data[0]);
  const floatIds = Array.from(
    new Set(
      data
        .map((row) => {
          const raw = row.float_id ?? row.float ?? row.id;
          if (raw === undefined || raw === null) return null;
          if (typeof raw === "string") {
            const trimmed = raw.trim();
            return trimmed.length ? trimmed : null;
          }
          try {
            return String(raw);
          } catch (error) {
            console.warn("createDataSynopsis: unable to normalize float identifier", error, { raw });
            return null;
          }
        })
        .filter((value): value is string => Boolean(value))
    )
  );

  const dateCandidates = [
    "profile_date",
    "observation_date",
    "date",
    "time",
  ];

  const parseDate = (value: unknown) => {
    if (!value) return null;
    const parsed = new Date(value as string);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const row of data) {
    for (const key of dateCandidates) {
      if (row[key]) {
        const parsed = parseDate(row[key]);
        if (!parsed) continue;
        if (!earliest || parsed < earliest) earliest = parsed;
        if (!latest || parsed > latest) latest = parsed;
      }
    }
  }

  const headline = `${data.length.toLocaleString()} records across ${floatIds.length || "several"} floats`;
  const highlights: string[] = [];

  if (floatIds.length) {
    highlights.push(`Sample float: ${floatIds.slice(0, 1).join(", ")}`);
  }

  if (earliest || latest) {
    const format = (date: Date | null) =>
      date
        ? date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null;
    highlights.push(
      `Date window: ${format(earliest) || "n/a"} → ${format(latest) || "n/a"}`,
    );
  }

  const numericColumns = columns.filter((column) =>
    data.some((row) => typeof row[column] === "number" && !Number.isNaN(row[column]))
  );

  if (numericColumns.length) {
    highlights.push(`Numeric fields detected: ${numericColumns.slice(0, 3).join(", ")}${
      numericColumns.length > 3 ? "…" : ""
    }`);
  }

  return {
    signature: `${data.length}-${columns.join("|")}-${floatIds.length}`,
    headline,
    highlights,
    columns,
    sampleFloat: floatIds[0],
    dateWindow: {
      start: earliest ? earliest.toISOString() : null,
      end: latest ? latest.toISOString() : null,
    },
  };
};

function App() {
  const [appData, setAppData] = useState<AppData>({ data: [], sqlQuery: "" });
  const [isLoading, setIsLoading] = useState(true); // For the initial welcome map
  const [mode, setMode] = useState<PersonaMode>("guided");
  const [complexityScore, setComplexityScore] = useState(0);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [dataSynopsis, setDataSynopsis] = useState<DataSynopsis | null>(null);
  const [activeTab, setActiveTab] = useState("analysis");
  const [expertFilters, setExpertFilters] = useState<ExpertFilters>({ focusMetric: "temperature" });
  const hasAutoOpenedPaletteRef = useRef(false);
  const [palettePrefill, setPalettePrefill] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>("operational");
  const [backendStatusDetail, setBackendStatusDetail] = useState<string>(BACKEND_STATUS_MAP.operational.description);
  const [chatInstanceKey, setChatInstanceKey] = useState(0);

  const updateBackendStatus = useCallback((status: BackendStatus, detail?: string) => {
    setBackendStatus(status);
    const baseline = BACKEND_STATUS_MAP[status].description;
    setBackendStatusDetail(detail && detail.trim() ? detail : baseline);
  }, []);

  const persistWelcomeData = useCallback((payload: AppData) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage?.setItem(WELCOME_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("FloatChat: unable to persist welcome dataset", error);
    }
  }, []);

  const loadCachedWelcomeData = useCallback((): AppData | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage?.getItem(WELCOME_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.data) && typeof parsed.sqlQuery === "string") {
        return { data: parsed.data, sqlQuery: parsed.sqlQuery };
      }
    } catch (error) {
      console.warn("FloatChat: unable to load cached welcome dataset", error);
    }
    return null;
  }, []);

  const fetchInitialData = useCallback(async () => {
    const initialQuestion = "Show me the location of 100 recent floats.";
    console.log("Fetching initial data for welcome map...");

    updateBackendStatus("operational", "Requesting welcome telemetry...");
    setIsLoading(true);

    const maxAttempts = 3;
    let success = false;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await askAI(initialQuestion);

        if (response && !response.error && Array.isArray(response.result_data) && response.sql_query) {
          const payload: AppData = { data: response.result_data, sqlQuery: response.sql_query };
          setAppData(payload);
          setDataSynopsis(createDataSynopsis(response.result_data));
          persistWelcomeData(payload);
          updateBackendStatus("operational", "Live telemetry synced.");
          success = true;
          break;
        }

        if (response?.error) {
          console.warn("FloatChat: welcome fetch error", response.error);
        }
      } catch (error) {
        console.warn("FloatChat: welcome fetch attempt failed", error);
      }

      if (success) {
        break;
      }

      if (attempt < maxAttempts - 1) {
        const backoff = 400 * (attempt + 1) * (attempt + 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    if (!success) {
      const cached = loadCachedWelcomeData();
      if (cached) {
        setAppData(cached);
        setDataSynopsis(createDataSynopsis(cached.data));
        updateBackendStatus("degraded", "Loaded cached telemetry while the backend recovers.");
      } else {
        setAppData({ data: [], sqlQuery: "" });
        setDataSynopsis(null);
        updateBackendStatus("offline", "Initial telemetry failed. Backend unreachable.");
      }
    }

    setIsLoading(false);
  }, [loadCachedWelcomeData, persistWelcomeData, updateBackendStatus]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key?.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        setShowCommandPalette(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (mode === "expert" && complexityScore >= COMPLEXITY_THRESHOLD && !hasAutoOpenedPaletteRef.current) {
      hasAutoOpenedPaletteRef.current = true;
      setShowCommandPalette(true);
    }
  }, [mode, complexityScore]);

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

  const missionStatusDescriptor = useMemo(() => {
    const base = BACKEND_STATUS_MAP[backendStatus];
    const detail = backendStatusDetail && backendStatusDetail.trim() ? backendStatusDetail : base.description;
    return {
      ...base,
      description: detail,
    };
  }, [backendStatus, backendStatusDetail]);

  const handleDataReceived = (data: Record<string, any>[], sqlQuery: string) => {
    setAppData({ data, sqlQuery });
    setDataSynopsis(createDataSynopsis(data));
    setActiveTab("analysis");
    if (data.length) {
      setIsLoading(false);
    }
  };

  const handleModeChange = (nextMode: PersonaMode) => {
    if (nextMode === "guided") {
      setMode("guided");
      setComplexityScore(0);
      hasAutoOpenedPaletteRef.current = false;
      setExpertFilters({ focusMetric: "temperature" });
    } else {
      setMode("expert");
    }
  };

  const handleComplexitySignal = (delta: number, query: string) => {
    if (query && query.trim()) {
      setRecentQueries((prev) => {
        const next = [query.trim(), ...prev.filter((entry) => entry !== query.trim())];
        return next.slice(0, 8);
      });
    }

    setComplexityScore((prev) => {
      const next = Math.max(0, prev + delta);
      if (mode === "guided" && next >= COMPLEXITY_THRESHOLD) {
        setMode("expert");
      }
      return next;
    });
  };

  const handleCommandAction = (action: string, payload?: string) => {
    switch (action) {
      case "switch-guided":
        handleModeChange("guided");
        break;
      case "switch-expert":
        setMode("expert");
        break;
      case "open-analysis":
        setActiveTab("analysis");
        break;
      case "open-map":
        setActiveTab("map");
        break;
      case "open-profiles":
        setActiveTab("profiles");
        break;
      case "open-sql":
        setActiveTab("sql");
        break;
      case "focus-temperature":
      case "focus-salinity":
      case "focus-pressure":
      case "focus-oxygen":
      case "focus-density":
        setExpertFilters((prev) => ({
          ...prev,
          focusMetric: (payload as ExpertFilters["focusMetric"]) || "temperature",
        }));
        break;
      case "clear-filters":
        setExpertFilters({ focusMetric: "temperature" });
        break;
      case "prefill-query":
        if (payload) {
          setPalettePrefill(payload);
        }
        break;
      default:
        break;
    }

    setShowCommandPalette(false);
  };

  const handlePrefillConsumed = useCallback(() => {
    setPalettePrefill(null);
  }, []);

  const handleBackendStatusChange = useCallback((status: BackendStatus, detail?: string) => {
    updateBackendStatus(status, detail);
  }, [updateBackendStatus]);

  const quickQueries = useMemo(() => {
    const suggestions: { label: string; prompt: string }[] = [];

    const floatIds = Array.from(
      new Set(
        appData.data
          .map((row) => row.float_id ?? row.float ?? row.id)
          .filter((value) => value !== undefined && value !== null)
          .map((value) => {
            try {
              return String(value).trim();
            } catch (error) {
              console.warn("FloatChat: unable to normalize float id for quick queries", error, { value });
              return "";
            }
          })
          .filter((value) => value.length > 0)
      )
    ).slice(0, 6);

    floatIds.forEach((floatId) => {
      suggestions.push({
        label: `Latest profile for float ${floatId}`,
        prompt: `Show me the most recent profile for float ${floatId}.`,
      });
    });

    if (dataSynopsis?.dateWindow?.start && dataSynopsis.dateWindow.end) {
      const start = new Date(dataSynopsis.dateWindow.start);
      const end = new Date(dataSynopsis.dateWindow.end);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const rangeLabel = `${start.toLocaleDateString()} → ${end.toLocaleDateString()}`;
        suggestions.push({
          label: `Summarize metrics for ${rangeLabel}`,
          prompt: `Summarize the key ocean metrics for floats observed between ${rangeLabel}.`,
        });
      }
    }

    GUIDED_EXAMPLES.slice(0, 3).forEach((example) => {
      if (!suggestions.some((suggestion) => suggestion.prompt === example)) {
        suggestions.push({ label: example, prompt: example });
      }
    });

    return suggestions.slice(0, 10);
  }, [appData.data, dataSynopsis]);

  const handleChatHardReset = useCallback(() => {
    setChatInstanceKey((prev) => prev + 1);
    setAppData({ data: [], sqlQuery: "" });
    setDataSynopsis(null);
    setActiveTab("analysis");
    setExpertFilters({ focusMetric: "temperature" });
    setRecentQueries([]);
    setPalettePrefill(null);
    setComplexityScore(0);
    setMode("guided");
    hasAutoOpenedPaletteRef.current = false;
    setShowCommandPalette(false);
    updateBackendStatus("operational", "Interface reset. Requesting fresh telemetry...");
    fetchInitialData();
  }, [fetchInitialData, updateBackendStatus]);

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <div className="relative min-h-screen w-full overflow-hidden bg-control-room text-slate-900 transition-colors duration-500 dark:text-slate-100">
        <div className="pointer-events-none absolute inset-0 ambient-veils opacity-60" />
        <div className="pointer-events-none absolute inset-0 grid-overlay opacity-20" />
        <div className="pointer-events-none absolute -top-56 -left-40 h-[420px] w-[420px] rounded-full gradient-ring blur-3xl opacity-40" />
        <div className="pointer-events-none absolute -bottom-64 right-[-20%] h-[520px] w-[520px] rounded-full gradient-ring blur-3xl opacity-30" />

        <main className="relative z-10 flex min-h-screen flex-col">
          <header className="w-full px-6 py-6 lg:px-10 lg:py-6">
            <div className="flex flex-wrap items-start justify-between gap-6 lg:items-center">
              <div className="space-y-3">
                <div className={`inline-flex items-center gap-3 rounded-full px-4 py-1.5 shadow-sm backdrop-blur-md ${missionStatusDescriptor.pillClass}`}>
                  <span className={`h-2 w-2 rounded-full ${missionStatusDescriptor.indicatorClass}`} />
                  <span className="text-[0.6rem] font-semibold uppercase tracking-[0.45em] text-slate-600 dark:text-slate-200">Mission Status</span>
                  <span className="text-[0.625rem] font-medium text-slate-600 dark:text-slate-200">{missionStatusDescriptor.label}</span>
                </div>
                <p className="text-[0.65rem] uppercase tracking-[0.24em] text-subtle">
                  {missionStatusDescriptor.description}
                </p>
                <div className="space-y-1.5">
                  <h1 className="text-3xl font-semibold leading-tight md:text-4xl">FloatChat Command Deck</h1>
                  <p className="max-w-xl text-sm text-subtle md:text-base">
                    Guide autonomous ocean missions, query the ARGO archive, and direct the analysis as the viewscreen responds in real time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-full bg-white/60 px-4 py-1.5 shadow-sm backdrop-blur dark:bg-white/10">
                <ThemeToggle />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCommandPalette(true)}
                  className="inline-flex items-center rounded-xl border-white/40 bg-white/80 px-4 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
                  aria-label="Open command palette"
                >
                  Command Palette
                </Button>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                icon={Database}
                label="Records processed"
                value={oceanMetrics.totalRecords}
                helper="Latest pipeline output"
              />
              <StatCard
                icon={Compass}
                label="Active float signatures"
                value={oceanMetrics.uniqueFloats}
                helper="Distinct IDs in scope"
              />
              <StatCard
                icon={CalendarDays}
                label="Latest observation"
                value={oceanMetrics.lastObservation}
                helper="Timestamp auto-synced"
              />
            </div>
          </header>

          <section className="flex w-full flex-1 flex-col px-6 pb-16 lg:px-10 min-h-0">
            <div className="grid flex-1 min-h-0 gap-8 pb-6 lg:grid-cols-[500px,minmax(0,1fr)] xl:grid-cols-[540px,minmax(0,1fr)] 2xl:grid-cols-[560px,minmax(0,1fr)]">
              <div className="mission-panel flex h-full min-h-0 flex-col p-6">
                <div className="pointer-events-none absolute inset-0 rounded-[32px] border-y border-white/10 dark:border-white/5" />
                <div className="relative z-10 flex h-full flex-col">
                  <ErrorBoundary onReset={handleChatHardReset}>
                    <ChatInterface
                      key={chatInstanceKey}
                      onDataReceived={handleDataReceived}
                      onComplexitySignal={handleComplexitySignal}
                      dataSummary={dataSynopsis}
                      palettePrefill={palettePrefill}
                      onPrefillConsumed={handlePrefillConsumed}
                      onBackendStatusChange={handleBackendStatusChange}
                    />
                  </ErrorBoundary>
                </div>
              </div>

              <div className="viewscreen-shell flex min-h-[520px] flex-1 flex-col p-8">
                <div className="relative z-10 flex h-full min-h-0 flex-col">
                  {isLoading ? (
                    <div className="flex flex-1 flex-col justify-center gap-6">
                      <LoadingPanel />
                    </div>
                  ) : (
                    <DataVisualization
                      data={appData.data}
                      sqlQuery={appData.sqlQuery}
                      mode={mode}
                      synopsis={dataSynopsis}
                      filters={expertFilters}
                      onFiltersChange={setExpertFilters}
                      activeTab={activeTab}
                      onTabChange={setActiveTab}
                    />
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
        <CommandPalette
          open={showCommandPalette}
          onOpenChange={setShowCommandPalette}
          mode={mode}
          onAction={handleCommandAction}
          recentQueries={recentQueries}
          filters={expertFilters}
          activeTab={activeTab}
          quickQueries={quickQueries}
        />
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
  <div className="glass-panel relative flex items-center gap-4 rounded-2xl border border-white/30 px-4 py-3">
    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-ocean text-white shadow-lg shadow-sky-500/30">
      <Icon className="h-5 w-5" />
      <div className="pointer-events-none absolute inset-0 bg-white/35 mix-blend-overlay" />
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[0.65rem] text-slate-500 dark:text-slate-300">{helper}</p>
    </div>
  </div>
);

const LoadingPanel = () => (
  <div className="grid gap-6">
    <div className="space-y-4">
      <div className="h-4 w-40 rounded-full bg-white/70 shadow-inner shadow-slate-200/40 dark:bg-white/10" />
      <div className="h-6 w-64 rounded-full bg-white/80 shadow-inner shadow-slate-200/40 dark:bg-white/10" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="h-28 rounded-2xl border border-white/30 bg-white/75 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.5)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]" />
      <div className="h-28 rounded-2xl border border-white/30 bg-white/75 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.5)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05]" />
    </div>
    <div className="h-64 rounded-[32px] border border-white/30 bg-white/70 shadow-[0_35px_70px_-45px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]" />
  </div>
);

export default App;
