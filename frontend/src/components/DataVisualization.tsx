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
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">Explore the Ocean</h3>
          <p className="text-muted-foreground">
            Ask a question in the chat panel to see your data visualized here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <h2 className="text-2xl font-bold mb-4">Explore the Results</h2>
      <Tabs defaultValue="analysis" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="analysis">📊 Analysis</TabsTrigger>
          <TabsTrigger value="map" disabled={!hasLocationData}>🗺️ Ocean Map</TabsTrigger>
          <TabsTrigger value="profiles" disabled={!hasTempProfileData && !hasSalProfileData}>📈 Profiles</TabsTrigger>
          <TabsTrigger value="sql">🔍 SQL Query</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="flex-1 overflow-y-auto mt-4 text-base">
            <h3 className="font-semibold mb-2 text-lg">Raw Data ({data.length} records)</h3>
            <div className="max-h-[400px] overflow-auto border rounded-md">
                <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 bg-muted">
                        <tr>
                            {Object.keys(data[0]).map(key => <th key={key} className="p-2 font-semibold">{key}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, i) => (
                            <tr key={i} className="border-t">
                                {Object.values(row).map((val, j) => <td key={j} className="p-2">{String(val)}</td>)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </TabsContent>

        <TabsContent value="map" className="flex-1 mt-4">
          <Plot
            data={[{
              type: 'scattermapbox',
              lat: data.map(r => r.latitude),
              lon: data.map(r => r.longitude),
              text: data.map(r => `Float: ${r.float_id}`),
              mode: 'markers',
              marker: { color: '#1f7ae0', size: 10 },
            }]}
            layout={{
              mapbox: { style: 'open-street-map', zoom: 1, center: { lat: data[0].latitude, lon: data[0].longitude } },
              margin: { r: 0, t: 0, b: 0, l: 0 },
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </TabsContent>
        
        <TabsContent value="profiles" className="flex-1 overflow-y-auto mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
           {hasTempProfileData && 
            <Plot
              data={[{ x: data.map(r => r.temperature), y: data.map(r => r.pressure), mode: 'lines+markers' }]}
              layout={{ title: 'Temperature vs. Depth', yaxis: { autorange: 'reversed', title: 'Pressure (dbar)' }, xaxis: { title: 'Temperature (°C)' } }}
              style={{ width: '100%', height: '400px' }}
              useResizeHandler={true}
            />
           }
           {hasSalProfileData &&
            <Plot
              data={[{ x: data.map(r => r.salinity), y: data.map(r => r.pressure), mode: 'lines+markers' }]}
              layout={{ title: 'Salinity vs. Depth', yaxis: { autorange: 'reversed', title: 'Pressure (dbar)' }, xaxis: { title: 'Salinity (PSU)' } }}
              style={{ width: '100%', height: '400px' }}
              useResizeHandler={true}
            />
           }
        </TabsContent>

        <TabsContent value="sql" className="flex-1 mt-4">
          <h3 className="font-semibold mb-2 text-lg">Generated SQL Query</h3>
          <div className="text-sm rounded-md p-4 bg-muted">
            <CodeBlock text={sqlQuery || "No query generated."} language="sql" theme={atomOneLight} showLineNumbers={false} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataVisualization;