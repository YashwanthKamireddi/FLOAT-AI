// This component is responsible for displaying all the visualizations
// based on the data received from the AI.

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock, atomOneLight } from 'react-code-blocks';
import Plot from 'react-plotly.js';
import { useMemo } from "react";

interface DataVisualizationProps {
  data: Record<string, any>[];
  sqlQuery: string;
}

const DataVisualization = ({ data, sqlQuery }: DataVisualizationProps) => {

  // useMemo is a professional React hook that prevents unnecessary recalculations.
  // It will only re-check for these columns when the 'data' prop actually changes.
  const hasLocationData = useMemo(() => data.length > 0 && 'latitude' in data[0] && 'longitude' in data[0], [data]);
  const hasTempProfileData = useMemo(() => data.length > 0 && 'temperature' in data[0] && 'pressure' in data[0], [data]);
  const hasSalProfileData = useMemo(() => data.length > 0 && 'salinity' in data[0] && 'pressure' in data[0], [data]);
  
  // This is the view when the app first loads or when a query returns no data.
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-white/40 p-10 text-center backdrop-blur-sm dark:bg-white/5">
        <div className="max-w-sm space-y-3">
          <h3 className="text-2xl font-semibold">Explore the ocean</h3>
          <p className="text-sm text-muted-foreground">
            Ask the assistant for a region, float, or depth range to light up this dashboard with maps and profiles.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 bg-white/50 p-6 text-sm backdrop-blur-sm dark:bg-white/[0.04]">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Explore the results</h2>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-300">Real-time visual analytics</p>
      </div>

      <Tabs defaultValue="analysis" className="flex flex-1 flex-col">
        <TabsList className="flex w-full flex-wrap gap-2 rounded-2xl bg-white/60 p-1 shadow-sm dark:bg-white/10">
          <TabsTrigger value="analysis" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10">📊 Analysis</TabsTrigger>
          <TabsTrigger value="map" disabled={!hasLocationData} className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10">🗺️ Ocean Map</TabsTrigger>
          <TabsTrigger value="profiles" disabled={!hasTempProfileData && !hasSalProfileData} className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10">📈 Profiles</TabsTrigger>
          <TabsTrigger value="sql" className="rounded-xl px-4 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-white/10">🔍 SQL Query</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="mt-4 flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/90 p-5 shadow-inner dark:border-white/10 dark:bg-white/[0.06]">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Raw Data ({data.length} records)</h3>
          <div className="mt-3 max-h-[360px] overflow-auto rounded-2xl border border-white/70 shadow-sm dark:border-white/10">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/10">
              <thead className="sticky top-0 bg-white/90 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/10 dark:text-slate-200">
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th key={key} className="px-4 py-2 text-left font-semibold">
                      {key.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70 dark:divide-white/5">
                {data.map((row, i) => (
                  <tr key={i} className="odd:bg-white/90 even:bg-white/70 dark:odd:bg-white/[0.08] dark:even:bg-white/[0.04]">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2 font-medium text-slate-700 dark:text-slate-100">
                        {String(val ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="map" className="mt-4 flex flex-1 overflow-hidden rounded-3xl border border-white/60 bg-transparent shadow-inner dark:border-white/10">
          <Plot
            data={[{
              type: 'scattermapbox',
              lat: data.map(r => r.latitude),
              lon: data.map(r => r.longitude),
              text: data.map(r => `Float: ${r.float_id}`),
              mode: 'markers',
              marker: { color: '#2563eb', size: 10, opacity: 0.85 },
            }]}
            layout={{
              mapbox: { style: 'open-street-map', zoom: 1.6, center: { lat: data[0].latitude, lon: data[0].longitude } },
              margin: { r: 0, t: 0, b: 0, l: 0 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)'
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>
        
        <TabsContent value="profiles" className="mt-4 grid flex-1 grid-cols-1 gap-4 overflow-auto rounded-3xl border border-white/60 bg-white/80 p-5 shadow-inner dark:border-white/10 dark:bg-white/[0.06] md:grid-cols-2">
           {hasTempProfileData && 
            <Plot
              data={[{ x: data.map(r => r.temperature), y: data.map(r => r.pressure), mode: 'lines+markers', line: { color: '#0ea5e9', width: 3 } }]}
              layout={{
                title: { text: 'Temperature vs. Depth' },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                yaxis: { autorange: 'reversed', title: { text: 'Pressure (dbar)' }, gridcolor: 'rgba(148, 163, 184, 0.3)' },
                xaxis: { title: { text: 'Temperature (°C)' }, gridcolor: 'rgba(148, 163, 184, 0.3)' }
              }}
              style={{ width: '100%', height: '360px' }}
              useResizeHandler={true}
            />
           }
           {hasSalProfileData &&
            <Plot
              data={[{ x: data.map(r => r.salinity), y: data.map(r => r.pressure), mode: 'lines+markers', line: { color: '#6366f1', width: 3 } }]}
              layout={{
                title: { text: 'Salinity vs. Depth' },
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                yaxis: { autorange: 'reversed', title: { text: 'Pressure (dbar)' }, gridcolor: 'rgba(148, 163, 184, 0.3)' },
                xaxis: { title: { text: 'Salinity (PSU)' }, gridcolor: 'rgba(148, 163, 184, 0.3)' }
              }}
              style={{ width: '100%', height: '360px' }}
              useResizeHandler={true}
            />
           }
        </TabsContent>

        <TabsContent value="sql" className="mt-4 flex-1 rounded-3xl border border-white/60 bg-slate-900/95 p-5 shadow-inner dark:border-white/10">
          <h3 className="text-lg font-semibold text-slate-100">Generated SQL Query</h3>
          <div className="mt-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-sm">
            <CodeBlock
              text={sqlQuery || "No query generated."}
              language="sql"
              theme={atomOneLight}
              showLineNumbers={false}
              customStyle={{ backgroundColor: "transparent", fontSize: "0.9rem" }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataVisualization;