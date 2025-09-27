import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, AreaChart, Area } from 'recharts';
import { TrendingUp, Droplets, Thermometer, Waves, Download } from 'lucide-react';

// Mock data for visualizations
const temperatureData = [
  { depth: 0, temp: 28.5, salinity: 34.2 },
  { depth: 50, temp: 26.8, salinity: 34.8 },
  { depth: 100, temp: 22.4, salinity: 35.1 },
  { depth: 200, temp: 18.2, salinity: 35.4 },
  { depth: 500, temp: 12.8, salinity: 35.0 },
  { depth: 1000, temp: 8.5, salinity: 34.6 },
  { depth: 1500, temp: 5.2, salinity: 34.4 },
  { depth: 2000, temp: 3.8, salinity: 34.7 }
];

const timeSeriesData = [
  { date: '2024-01-15', temp: 24.2, salinity: 35.1 },
  { date: '2024-01-16', temp: 24.8, salinity: 35.0 },
  { date: '2024-01-17', temp: 25.1, salinity: 34.9 },
  { date: '2024-01-18', temp: 24.6, salinity: 35.2 },
  { date: '2024-01-19', temp: 25.3, salinity: 35.1 },
  { date: '2024-01-20', temp: 25.0, salinity: 35.0 },
  { date: '2024-01-21', temp: 25.4, salinity: 34.8 }
];

const DataVisualization = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-surface">
        <div className="flex items-center space-x-4">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Ocean Profiles
          </h3>
          <Badge variant="secondary">Float A001</Badge>
        </div>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Visualization Tabs */}
      <div className="flex-1 p-4">
        <Tabs defaultValue="profiles" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="profiles">Depth Profiles</TabsTrigger>
            <TabsTrigger value="timeseries">Time Series</TabsTrigger>
            <TabsTrigger value="scatter">T-S Diagram</TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="flex-1 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
              {/* Temperature Profile */}
              <Card className="p-4 bg-gradient-surface/50">
                <div className="flex items-center gap-2 mb-4">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  <h4 className="font-semibold">Temperature Profile</h4>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={temperatureData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="temp" 
                      label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      dataKey="depth" 
                      reversed 
                      label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="temp" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Salinity Profile */}
              <Card className="p-4 bg-gradient-surface/50">
                <div className="flex items-center gap-2 mb-4">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <h4 className="font-semibold">Salinity Profile</h4>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={temperatureData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="salinity" 
                      label={{ value: 'Salinity (PSU)', position: 'insideBottom', offset: -10 }}
                    />
                    <YAxis 
                      dataKey="depth" 
                      reversed 
                      label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="salinity" 
                      stroke="hsl(var(--accent))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--accent))', strokeWidth: 2, r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeseries" className="flex-1 mt-0">
            <Card className="p-4 h-full bg-gradient-surface/50">
              <div className="flex items-center gap-2 mb-4">
                <Waves className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Surface Parameters Over Time</h4>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="temp" 
                    stackId="1" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.3)"
                    name="Temperature (°C)"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="salinity" 
                    stackId="2" 
                    stroke="hsl(var(--accent))" 
                    fill="hsl(var(--accent) / 0.3)"
                    name="Salinity (PSU)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>

          <TabsContent value="scatter" className="flex-1 mt-0">
            <Card className="p-4 h-full bg-gradient-surface/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h4 className="font-semibold">Temperature-Salinity Diagram</h4>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    type="number" 
                    dataKey="salinity" 
                    domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    label={{ value: 'Salinity (PSU)', position: 'insideBottom', offset: -10 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="temp"
                    domain={['dataMin - 1', 'dataMax + 1']}
                    label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Scatter 
                    data={temperatureData} 
                    fill="hsl(var(--primary))"
                    stroke="hsl(var(--primary-foreground))"
                    strokeWidth={1}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Stats Footer */}
      <div className="p-3 border-t bg-gradient-surface grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-primary">25.2°C</div>
          <div className="text-xs text-muted-foreground">Surface Temp</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-accent">34.9 PSU</div>
          <div className="text-xs text-muted-foreground">Surface Salinity</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-foreground">2,000m</div>
          <div className="text-xs text-muted-foreground">Max Depth</div>
        </div>
      </div>
    </div>
  );
};

export default DataVisualization;