// This component is responsible for displaying all the visualizations
// based on the data received from the AI.

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import CodeSnippet from "./CodeSnippet";
import { lazy, Suspense, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { BarChart2, Globe2, LineChart, Code } from "lucide-react";

const Plot = lazy(() => import("react-plotly.js"));

type PersonaMode = "guided" | "expert";

type FocusMetric = "temperature" | "salinity" | "pressure" | "oxygen" | "density";

interface ExpertFilters {
  focusMetric: FocusMetric;
  floatId?: string;
  depthRange?: [number | null, number | null];
}

interface DataSynopsis {
  signature: string;
  headline: string;
  highlights: string[];
  columns: string[];
  sampleFloat?: string;
  dateWindow?: { start: string | null; end: string | null };
}

interface DataVisualizationProps {
  data: Record<string, any>[];
  sqlQuery: string;
  mode: PersonaMode;
  synopsis: DataSynopsis | null;
  filters: ExpertFilters;
  onFiltersChange: Dispatch<SetStateAction<ExpertFilters>>;
  activeTab: string;
  onTabChange: (nextTab: string) => void;
}

const metricLabels: Record<FocusMetric, string> = {
  temperature: "Temperature (°C)",
  salinity: "Salinity (PSU)",
  pressure: "Pressure (dbar)",
  oxygen: "Oxygen (µmol/kg)",
  density: "Density (kg/m³)",
};

const metricKeys: Record<FocusMetric, string> = {
  temperature: "temperature",
  salinity: "salinity",
  pressure: "pressure",
  oxygen: "oxygen",
  density: "density",
};

const formatNumber = (value: number | null, maximumFractionDigits = 2) => {
  if (value === null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
};

const computeStats = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const mean = sum / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[(sorted.length - 1) / 2];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);

  return { mean, median, min, max, stddev, count: values.length };
};

const extractNumericValues = (rows: Record<string, any>[], key: string) =>
  rows
    .map((row) => (typeof row[key] === "number" && !Number.isNaN(row[key]) ? (row[key] as number) : null))
    .filter((value): value is number => value !== null);

const PlotFallback = ({ label }: { label: string }) => (
  <div className="flex h-full min-h-[260px] w-full items-center justify-center text-[0.65rem] uppercase tracking-[0.28em] text-subtle">
    {label}
  </div>
);

const DataVisualization = ({
  data,
  sqlQuery,
  mode,
  synopsis,
  filters,
  onFiltersChange,
  activeTab,
  onTabChange,
}: DataVisualizationProps) => {

  const filteredData = useMemo(() => {
    if (mode !== "expert") {
      return data;
    }

    let next = [...data];

    if (filters.floatId) {
      next = next.filter((row) => String(row.float_id) === filters.floatId);
    }

    if (filters.depthRange && filters.depthRange[0] !== null) {
      const [minDepth, maxDepth] = filters.depthRange;
      next = next.filter((row) => {
        const depth = row.pressure;
        if (typeof depth !== "number" || Number.isNaN(depth)) return false;
        if (minDepth !== null && depth < minDepth) return false;
        if (maxDepth !== null && depth > maxDepth) return false;
        return true;
      });
    }

    return next;
  }, [data, filters, mode]);

  const workingData = filteredData;

  const locationPoints = useMemo(
    () =>
      workingData
        .map((row) => {
          const rawLat = row.latitude;
          const rawLon = row.longitude;
          const lat = typeof rawLat === "number" ? rawLat : Number.parseFloat(rawLat);
          const lon = typeof rawLon === "number" ? rawLon : Number.parseFloat(rawLon);

          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            return {
              lat,
              lon,
              floatId: row.float_id ?? "n/a",
            };
          }
          return null;
        })
        .filter((point): point is { lat: number; lon: number; floatId: string | number } => point !== null),
    [workingData],
  );

  const hasLocationData = locationPoints.length > 0;
  const hasTempProfileData = useMemo(
    () => workingData.length > 0 && "temperature" in workingData[0] && "pressure" in workingData[0],
    [workingData],
  );
  const hasSalProfileData = useMemo(
    () => workingData.length > 0 && "salinity" in workingData[0] && "pressure" in workingData[0],
    [workingData],
  );

  const floatOptions = useMemo(() => {
    const floats = new Set<string>();
    data.forEach((row) => {
      if (row.float_id !== undefined && row.float_id !== null) {
        floats.add(String(row.float_id));
      }
    });
    return Array.from(floats).slice(0, 24);
  }, [data]);

  const depthBounds = useMemo(() => {
    const depths = data
      .map((row) => (typeof row.pressure === "number" && !Number.isNaN(row.pressure) ? (row.pressure as number) : null))
      .filter((value): value is number => value !== null);
    if (!depths.length) return null;
    return {
      min: Math.min(...depths),
      max: Math.max(...depths),
    };
  }, [data]);

  const depthSliderValue = useMemo(() => {
    if (filters.depthRange) {
      return filters.depthRange.map((value, index) => {
        if (value === null && depthBounds) {
          return index === 0 ? depthBounds.min : depthBounds.max;
        }
        return value ?? 0;
      }) as [number, number];
    }

    if (depthBounds) {
      return [depthBounds.min, depthBounds.max] as [number, number];
    }

    return [0, 0] as [number, number];
  }, [filters.depthRange, depthBounds]);

  const metricValues = useMemo(
    () => extractNumericValues(workingData, metricKeys[filters.focusMetric]),
    [workingData, filters.focusMetric],
  );

  const metricStats = useMemo(() => computeStats(metricValues), [metricValues]);

  const updateFilters = (partial: Partial<ExpertFilters>) => {
    onFiltersChange((prev) => ({ ...prev, ...partial }));
  };

  const handleDepthChange = (value: number[]) => {
    if (!depthBounds) return;
    updateFilters({ depthRange: [value[0], value[1]] });
  };

  const handleFloatChange = (value: string) => {
    updateFilters({ floatId: value === "all" ? undefined : value });
  };

  const selectedFloat = filters.floatId ?? "all";

  // This is the view when the app first loads or when a query returns no data.
  if (data.length === 0) {
    return (
      <div className="viewscreen-stage flex h-full flex-col items-center justify-center gap-6 text-center text-slate-700 dark:text-slate-200">
        <div className="relative z-10 max-w-sm space-y-4">
          <p className="control-label text-slate-500 dark:text-slate-300">Main viewscreen</p>
          <h3 className="text-2xl font-semibold">Awaiting scientific directive</h3>
          <p className="text-sm leading-relaxed text-subtle">
            {mode === "guided"
              ? "Choose one of the guided example questions or describe what you’d like to learn and I’ll populate the viewscreen with annotated results."
              : "Issue a focused command or open the palette (⌘K) to jump straight to analysis, maps, profiles, or SQL."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 text-sm">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="control-label text-slate-500 dark:text-slate-300">Main viewscreen</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">Mission telemetry</h2>
          </div>
          <div className="rounded-full border border-white/30 bg-white/70 px-4 py-1 text-[0.7rem] uppercase tracking-[0.32em] text-slate-500 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300">
            Live feed
          </div>
        </div>
        <p className="max-w-xl text-sm text-subtle">
          {mode === "guided"
            ? "I’ll narrate each view, highlighting what matters most. Toggle the tabs to see how the story unfolds."
            : "Use the tabs or the ⌘K palette to jump between telemetry, geospatial tracking, profile analysis, and the raw SQL driving every chart."}
        </p>
      </div>

      {synopsis && (
        <div className="rounded-[24px] border border-white/25 bg-white/75 p-6 shadow-[0_25px_50px_-35px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Data briefing</p>
          <h4 className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">{synopsis.headline}</h4>
          <ul className="mt-4 grid gap-2 text-sm text-subtle md:grid-cols-2">
            {synopsis.highlights.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {synopsis.sampleFloat && (
            <p className="mt-4 text-xs uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
              Example float: {synopsis.sampleFloat}
            </p>
          )}
        </div>
      )}

      {mode === "expert" && metricStats && (
        <div className="grid gap-4 rounded-[24px] border border-white/20 bg-white/65 p-6 shadow-[0_25px_50px_-35px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="control-label text-slate-500 dark:text-slate-300">Metric spotlight</p>
              <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{metricLabels[filters.focusMetric]}</h4>
            </div>
            <Badge className="rounded-full bg-slate-900 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-white dark:bg-white/80 dark:text-slate-900">
              n = {metricStats.count}
            </Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatPill label="Mean" value={formatNumber(metricStats.mean)} />
            <StatPill label="Median" value={formatNumber(metricStats.median)} />
            <StatPill label="Min" value={formatNumber(metricStats.min)} />
            <StatPill label="Max" value={formatNumber(metricStats.max)} />
            <StatPill label="Std Dev" value={formatNumber(metricStats.stddev)} />
          </div>
        </div>
      )}

      {mode === "expert" && (
        <div className="rounded-[24px] border border-white/20 bg-white/65 p-6 shadow-[0_25px_50px_-40px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.06]">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Float focus</p>
              <Select value={selectedFloat} onValueChange={handleFloatChange}>
                <SelectTrigger className="w-full rounded-xl border border-white/30 bg-white/80 text-sm text-slate-600 shadow-sm focus:ring-0 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100">
                  <SelectValue placeholder="All floats" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto rounded-xl border border-white/20 bg-white/95 dark:border-white/10 dark:bg-slate-900/95">
                  <SelectItem value="all">All floats</SelectItem>
                  {floatOptions.map((id) => (
                    <SelectItem key={id} value={id}>
                      Float {id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Depth window (dbar)</p>
              {depthBounds ? (
                <>
                  <Slider
                    value={depthSliderValue}
                    min={Math.floor(depthBounds.min)}
                    max={Math.ceil(depthBounds.max)}
                    step={25}
                    onValueChange={handleDepthChange}
                  />
                  <div className="flex justify-between text-xs text-slate-500 dark:text-slate-300">
                    <span>{Math.round(depthSliderValue[0])}</span>
                    <span>{Math.round(depthSliderValue[1])}</span>
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-white/40 p-4 text-xs text-slate-500 dark:border-white/15 dark:text-slate-300">
                  Depth filtering unavailable for this result set.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">Metric lens</p>
              <Select value={filters.focusMetric} onValueChange={(value) => updateFilters({ focusMetric: value as FocusMetric })}>
                <SelectTrigger className="w-full rounded-xl border border-white/30 bg-white/80 text-sm text-slate-600 shadow-sm focus:ring-0 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border border-white/20 bg-white/95 dark:border-white/10 dark:bg-slate-900/95">
                  {Object.entries(metricLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-1 min-h-0 flex-col gap-6">
  <TabsList className="mx-auto inline-flex h-auto shrink-0 flex-wrap items-center justify-center gap-2 bg-transparent p-0 text-inherit">
          <TabsTrigger value="analysis" className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.28em] text-slate-500 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white">
            <span className="inline-flex h-4 w-4 items-center justify-center"><BarChart2 className="h-3.5 w-3.5" /></span>
            Analysis
          </TabsTrigger>
          <TabsTrigger value="map" disabled={!hasLocationData} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.28em] text-slate-500 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm disabled:opacity-40 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white">
            <span className="inline-flex h-4 w-4 items-center justify-center"><Globe2 className="h-3.5 w-3.5" /></span>
            Ocean Map
          </TabsTrigger>
          <TabsTrigger value="profiles" disabled={!hasTempProfileData && !hasSalProfileData} className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.28em] text-slate-500 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm disabled:opacity-40 dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white">
            <span className="inline-flex h-4 w-4 items-center justify-center"><LineChart className="h-3.5 w-3.5" /></span>
            Profiles
          </TabsTrigger>
          <TabsTrigger value="sql" className="flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-center text-xs font-medium uppercase tracking-[0.28em] text-slate-500 transition data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white">
            <span className="inline-flex h-4 w-4 items-center justify-center"><Code className="h-3.5 w-3.5" /></span>
            SQL Query
          </TabsTrigger>
        </TabsList>

        {activeTab === "analysis" && (
          <TabsContent value="analysis" className="mt-2 flex flex-1 min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white/85 p-6 shadow-[0_35px_70px_-50px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_45px_90px_-55px_rgba(2,6,23,0.85)]">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Raw data {`(${workingData.length} records)`}</h3>
            {workingData.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                Filters removed all rows. Adjust your focus above to bring data back into view.
              </div>
            ) : (
              <div className="mt-4 flex-1 overflow-hidden">
                <ScrollArea className="data-scroll h-full max-h-[60vh] rounded-2xl border border-white/40 bg-white/75 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-black/30">
                  <div className="min-w-full">
                    <table className="min-w-full divide-y divide-slate-200 text-sm leading-relaxed dark:divide-white/10">
                      <thead className="sticky top-0 z-20 bg-white/95 text-[0.7rem] uppercase tracking-[0.28em] text-slate-500 shadow-[0_8px_16px_-12px_rgba(15,23,42,0.3)] backdrop-blur supports-[backdrop-filter]:bg-white/85 dark:bg-slate-950/85 dark:text-slate-200 dark:shadow-[0_8px_16px_-12px_rgba(2,6,23,0.65)]">
                        <tr>
                          {Object.keys(workingData[0]).map((key) => (
                            <th key={key} className="px-4 py-3 text-left font-semibold text-slate-600 dark:text-slate-100">
                              {key.replace(/_/g, " ")}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/70 bg-white/80 text-slate-700 dark:divide-white/5 dark:bg-white/[0.03] dark:text-slate-100">
                        {workingData.map((row, i) => (
                          <tr key={i} className="transition-colors hover:bg-sky-50/80 dark:hover:bg-white/[0.08]">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-4 py-3 font-medium">
                                {String(val ?? "—")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        )}

        {activeTab === "map" && (
          <TabsContent value="map" className="mt-2 flex flex-1 min-h-0 overflow-hidden rounded-[28px] border border-white/20 bg-transparent shadow-[0_35px_70px_-50px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:shadow-[0_45px_90px_-55px_rgba(2,6,23,0.85)]">
            {!hasLocationData ? (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-300">
                Location metadata isn’t available for the current selection.
              </div>
            ) : (
              <Suspense fallback={<PlotFallback label="Loading map" />}>
                <Plot
                  data={[
                    {
                      type: "scattergeo",
                      lat: locationPoints.map((point) => point.lat),
                      lon: locationPoints.map((point) => point.lon),
                      text: locationPoints.map((point) => `Float: ${point.floatId}`),
                      mode: "markers",
                      marker: { color: "#2563eb", size: 10, opacity: 0.85 },
                    },
                  ]}
                  layout={{
                    geo: {
                      scope: "world",
                      showland: true,
                      landcolor: "#f1f5f9",
                      oceancolor: "#e2e8f0",
                      lakecolor: "#e2e8f0",
                      projection: { type: "natural earth" },
                      lonaxis: { showgrid: true, gridcolor: "rgba(148, 163, 184, 0.3)", dtick: 30 },
                      lataxis: { showgrid: true, gridcolor: "rgba(148, 163, 184, 0.3)", dtick: 15 },
                    },
                    margin: { r: 0, t: 10, b: 0, l: 0 },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                  }}
                  style={{ width: "100%", height: "100%" }}
                  useResizeHandler
                  config={{ displayModeBar: false, responsive: true }}
                />
              </Suspense>
            )}
          </TabsContent>
        )}

        {activeTab === "profiles" && (
          <TabsContent value="profiles" className="mt-2 grid flex-1 min-h-0 grid-cols-1 gap-4 overflow-auto rounded-[28px] border border-white/20 bg-white/85 p-6 shadow-[0_35px_70px_-50px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_45px_90px_-55px_rgba(2,6,23,0.85)] md:grid-cols-2">
            {hasTempProfileData ? (
              <Suspense fallback={<PlotFallback label="Loading temperature profile" />}>
                <Plot
                  data={[
                    {
                      x: workingData.map((r) => r.temperature),
                      y: workingData.map((r) => r.pressure),
                      mode: "lines+markers",
                      line: { color: "#0ea5e9", width: 3 },
                    },
                  ]}
                  layout={{
                    title: { text: "Temperature vs. Depth" },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    yaxis: { autorange: "reversed", title: { text: "Pressure (dbar)" }, gridcolor: "rgba(148, 163, 184, 0.3)" },
                    xaxis: { title: { text: "Temperature (°C)" }, gridcolor: "rgba(148, 163, 184, 0.3)" },
                  }}
                  style={{ width: "100%", height: "360px" }}
                  useResizeHandler
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/40 p-6 text-sm text-slate-500 dark:border-white/15 dark:text-slate-300">
                Temperature profiles unavailable for this selection.
              </div>
            )}

            {hasSalProfileData ? (
              <Suspense fallback={<PlotFallback label="Loading salinity profile" />}>
                <Plot
                  data={[
                    {
                      x: workingData.map((r) => r.salinity),
                      y: workingData.map((r) => r.pressure),
                      mode: "lines+markers",
                      line: { color: "#6366f1", width: 3 },
                    },
                  ]}
                  layout={{
                    title: { text: "Salinity vs. Depth" },
                    paper_bgcolor: "rgba(0,0,0,0)",
                    plot_bgcolor: "rgba(0,0,0,0)",
                    yaxis: { autorange: "reversed", title: { text: "Pressure (dbar)" }, gridcolor: "rgba(148, 163, 184, 0.3)" },
                    xaxis: { title: { text: "Salinity (PSU)" }, gridcolor: "rgba(148, 163, 184, 0.3)" },
                  }}
                  style={{ width: "100%", height: "360px" }}
                  useResizeHandler
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-white/40 p-6 text-sm text-slate-500 dark:border-white/15 dark:text-slate-300">
                Salinity profiles unavailable for this selection.
              </div>
            )}
          </TabsContent>
        )}

        {activeTab === "sql" && (
          <TabsContent value="sql" className="mt-2 flex flex-1 min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/20 bg-white/85 p-6 shadow-[0_35px_70px_-50px_rgba(15,23,42,0.55)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_45px_90px_-55px_rgba(2,6,23,0.85)]">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Generated SQL query</h3>
            <div className="mt-4 flex-1 overflow-auto rounded-2xl border border-slate-800/60 bg-slate-900/90 text-slate-100 shadow-inner">
              <CodeSnippet code={sqlQuery || "No query generated."} language="sql" className="bg-transparent text-[0.9rem]" />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default DataVisualization;

const StatPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-white/30 bg-white/80 p-4 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-300">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{value}</p>
  </div>
);
