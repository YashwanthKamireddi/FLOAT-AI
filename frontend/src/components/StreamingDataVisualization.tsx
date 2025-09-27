import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { BarChart3, Play, Pause, Download, Thermometer, Droplets, Wind, RefreshCw } from 'lucide-react';
import { floatChatAPI, ArgoProfile, DataFilters } from '@/services/api';

interface StreamingDataVisualizationProps {
  filters?: DataFilters;
  highlightedFloats?: string[];
}

const StreamingDataVisualization = ({ filters, highlightedFloats = [] }: StreamingDataVisualizationProps) => {
  const [selectedFloat, setSelectedFloat] = useState<string>('');
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [profileData, setProfileData] = useState<ArgoProfile | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<any>(null);
  const [qualityData, setQualityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const loadData = async () => {
    if (!selectedFloat || !selectedVariable) {
      return; // Don't load data if nothing is selected
    }

    setLoading(true);
    try {
      const [profile, timeSeries, quality] = await Promise.all([
        floatChatAPI.getFloatProfile(selectedFloat, selectedVariable),
        floatChatAPI.getTimeSeriesData(selectedFloat, selectedVariable),
        floatChatAPI.getDataQuality(selectedFloat)
      ]);

      setProfileData(profile);
      setTimeSeriesData(timeSeries);
      setQualityData(quality);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFloat, selectedVariable]);

  useEffect(() => {
    if (highlightedFloats.length > 0) {
      setSelectedFloat(highlightedFloats[0]);
      // Set default variable if not selected
      if (!selectedVariable) {
        setSelectedVariable('temperature');
      }
    }
  }, [highlightedFloats, selectedVariable]);

  const toggleStreaming = () => {
    setStreaming(!streaming);
    // In a real implementation, this would start/stop WebSocket streaming
  };

  const getVariableUnit = (variable: string) => {
    switch (variable) {
      case 'temperature': return '°C';
      case 'salinity': return 'PSU';
      case 'oxygen': return 'μmol/kg';
      default: return '';
    }
  };

  const getVariableColor = (variable: string) => {
    switch (variable) {
      case 'temperature': return '#ef4444';
      case 'salinity': return '#3b82f6';
      case 'oxygen': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatProfileData = () => {
    if (!profileData) return [];
    return profileData.depth.map((depth, index) => ({
      depth: -depth, // Negative for proper depth visualization
      value: profileData.values[index],
      quality: profileData.quality_flags[index]
    }));
  };

  const formatTimeSeriesData = () => {
    if (!timeSeriesData?.data) return [];
    return timeSeriesData.data.map((point: any, index: number) => ({
      time: index,
      date: new Date(point.timestamp).toLocaleDateString(),
      value: point[selectedVariable] || 0
    }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Data Profiles
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedFloat} onValueChange={setSelectedFloat}>
            <SelectTrigger className="w-40 font-medium">
              <SelectValue placeholder="🌊 Select Float ID" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6901234">Float 6901234</SelectItem>
              <SelectItem value="5904321">Float 5904321</SelectItem>
              <SelectItem value="7905678">Float 7905678</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedVariable} onValueChange={setSelectedVariable}>
            <SelectTrigger className="w-40 font-medium">
              <SelectValue placeholder="📊 Select Data Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temperature">🌡️ Temperature</SelectItem>
              <SelectItem value="salinity">💧 Salinity</SelectItem>
              <SelectItem value="oxygen">💨 Oxygen</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={toggleStreaming}
            variant={streaming ? "default" : "outline"}
            size="sm"
          >
            {streaming ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>

          <Button onClick={loadData} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Visualization Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Depth Profile</TabsTrigger>
          <TabsTrigger value="timeseries">Time Series</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex-1 mt-4">
          {!selectedFloat || !selectedVariable ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select Float and Data Type</h3>
                <p className="text-sm">Choose a float ID and data variable to view the depth profile</p>
              </div>
            </Card>
          ) : (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {selectedVariable === 'temperature' && <Thermometer className="w-4 h-4" />}
                  {selectedVariable === 'salinity' && <Droplets className="w-4 h-4" />}
                  {selectedVariable === 'oxygen' && <Wind className="w-4 h-4" />}
                  {selectedVariable.charAt(0).toUpperCase() + selectedVariable.slice(1)} Profile
                  <Badge variant="outline" className="ml-auto">
                    Float {selectedFloat}
                  </Badge>
                </CardTitle>
              </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={formatProfileData()}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="value"
                      label={{ value: `${selectedVariable.charAt(0).toUpperCase() + selectedVariable.slice(1)} (${getVariableUnit(selectedVariable)})`, position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      dataKey="depth"
                      label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => [
                        `${value.toFixed(2)} ${getVariableUnit(selectedVariable)}`,
                        selectedVariable.charAt(0).toUpperCase() + selectedVariable.slice(1)
                      ]}
                      labelFormatter={(depth: any) => `Depth: ${Math.abs(depth)}m`}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={getVariableColor(selectedVariable)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="timeseries" className="flex-1 mt-4">
          {!selectedFloat || !selectedVariable ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select Float and Data Type</h3>
                <p className="text-sm">Choose a float ID and data variable to view the time series</p>
              </div>
            </Card>
          ) : (
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">30-Day Time Series</CardTitle>
              </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={formatTimeSeriesData()}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(value) => `Day ${value + 1}`}
                    />
                    <YAxis
                      label={{ value: `${selectedVariable.charAt(0).toUpperCase() + selectedVariable.slice(1)} (${getVariableUnit(selectedVariable)})`, angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        `${value.toFixed(2)} ${getVariableUnit(selectedVariable)}`,
                        selectedVariable.charAt(0).toUpperCase() + selectedVariable.slice(1)
                      ]}
                      labelFormatter={(time: any) => formatTimeSeriesData()[time]?.date || `Day ${time + 1}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={getVariableColor(selectedVariable)}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="quality" className="flex-1 mt-4">
          {!selectedFloat ? (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select Float</h3>
                <p className="text-sm">Choose a float ID to view data quality metrics</p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quality Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {qualityData && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Overall Quality</span>
                      <Badge variant="default">
                        {(qualityData.overall_quality * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Temperature Quality</span>
                      <Badge variant="secondary">
                        {(qualityData.temperature_quality * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Salinity Quality</span>
                      <Badge variant="secondary">
                        {(qualityData.salinity_quality * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Missing Data</span>
                      <Badge variant="outline">
                        {(qualityData.missing_data_percentage * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quality Flags Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart
                      data={formatProfileData()}
                      margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                    >
                      <CartesianGrid />
                      <XAxis dataKey="value" />
                      <YAxis dataKey="depth" />
                      <Tooltip />
                      <Scatter
                        dataKey="quality"
                        fill={getVariableColor(selectedVariable)}
                        fillOpacity={0.6}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StreamingDataVisualization;
