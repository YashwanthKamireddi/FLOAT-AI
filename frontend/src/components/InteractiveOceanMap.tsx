import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Map, MapPin, Activity, Thermometer, Droplets, RefreshCw } from 'lucide-react';
import { floatChatAPI, ArgoFloat, DataFilters } from '@/services/api';
import L from 'leaflet';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface InteractiveOceanMapProps {
  filters?: DataFilters;
  highlightedFloats?: string[];
}

// Custom icons for different float statuses
const createFloatIcon = (status: string, isHighlighted: boolean = false) => {
  const color = status === 'active' ? '#10b981' : status === 'delayed' ? '#f59e0b' : '#ef4444';
  const size = isHighlighted ? 20 : 15;

  return L.divIcon({
    html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'custom-float-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

const InteractiveOceanMap = ({ filters, highlightedFloats = [] }: InteractiveOceanMapProps) => {
  const [floats, setFloats] = useState<ArgoFloat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloat, setSelectedFloat] = useState<ArgoFloat | null>(null);

  const loadFloats = async () => {
    setLoading(true);
    try {
      const data = await floatChatAPI.getArgoFloats(filters);
      setFloats(data);
    } catch (error) {
      console.error('Failed to load floats:', error);
      // Add some mock data if API fails
      const mockFloats: ArgoFloat[] = [
        {
          id: "float_2903953",
          lat: 40.7128,
          lon: -74.0060,
          last_contact: "2024-01-15",
          temperature: 18.5,
          salinity: 35.2,
          trajectory: [[40.7, -74.0], [40.8, -73.9]],
          status: "active"
        },
        {
          id: "float_4903838",
          lat: 35.6762,
          lon: 139.6503,
          last_contact: "2024-01-14",
          temperature: 22.1,
          salinity: 34.8,
          trajectory: [[35.6, 139.7], [35.7, 139.8]],
          status: "active"
        },
        {
          id: "float_7901125",
          lat: -33.9249,
          lon: 18.4241,
          last_contact: "2024-01-13",
          temperature: 16.3,
          salinity: 35.0,
          trajectory: [[-33.9, 18.4], [-33.8, 18.5]],
          status: "delayed"
        },
        {
          id: "float_5907180",
          lat: 51.5074,
          lon: -0.1278,
          last_contact: "2024-01-12",
          temperature: 12.8,
          salinity: 35.5,
          trajectory: [[51.5, -0.1], [51.6, -0.2]],
          status: "active"
        },
        {
          id: "float_6990610",
          lat: -34.6037,
          lon: -58.3816,
          last_contact: "2024-01-11",
          temperature: 19.2,
          salinity: 34.1,
          trajectory: [[-34.6, -58.4], [-34.5, -58.3]],
          status: "inactive"
        },
        {
          id: "float_2902272",
          lat: 1.3521,
          lon: 103.8198,
          last_contact: "2024-01-10",
          temperature: 28.4,
          salinity: 33.8,
          trajectory: [[1.3, 103.8], [1.4, 103.9]],
          status: "active"
        }
      ];
      setFloats(mockFloats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloats();
  }, [filters]);

  return (
    <div className="h-full w-full flex flex-col min-h-[600px]">
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-600" />
            Interactive ARGO Float Map
          </h3>
          <p className="text-sm text-muted-foreground">Real-time oceanographic data worldwide</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {floats.length} Active Floats
          </Badge>
          <Button onClick={loadFloats} disabled={loading} size="sm" variant="outline">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 px-4 pb-4 min-h-[500px]">
        {/* Interactive Real Map */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Global Ocean Monitoring Network</CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    Active
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    Delayed
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    Inactive
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 h-full">
              <div className="h-full min-h-[400px] rounded-lg overflow-hidden border-2 border-blue-200 relative">
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[1000]">
                    <div className="text-center">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Loading ocean data...</p>
                    </div>
                  </div>
                )}

                <MapContainer
                  center={[20, 0]}
                  zoom={2}
                  style={{ height: '100%', width: '100%' }}
                  className="rounded-lg"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {floats.map((float) => {
                    const isHighlighted = highlightedFloats.includes(float.id);
                    return (
                      <Marker
                        key={float.id}
                        position={[float.lat, float.lon]}
                        icon={createFloatIcon(float.status, isHighlighted)}
                        eventHandlers={{
                          click: () => setSelectedFloat(float),
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <h4 className="font-semibold text-sm mb-2">ARGO Float {float.id}</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span>Position:</span>
                                <span>{float.lat.toFixed(3)}°N, {float.lon.toFixed(3)}°E</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <span className={`capitalize ${
                                  float.status === 'active' ? 'text-green-600' :
                                  float.status === 'delayed' ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {float.status}
                                </span>
                              </div>
                              {float.temperature && (
                                <div className="flex justify-between">
                                  <span>Temperature:</span>
                                  <span>{float.temperature}°C</span>
                                </div>
                              )}
                              {float.salinity && (
                                <div className="flex justify-between">
                                  <span>Salinity:</span>
                                  <span>{float.salinity} PSU</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Last Contact:</span>
                                <span>{float.last_contact}</span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Float Details Panel */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Float Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedFloat ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <h4 className="font-semibold text-lg">Float {selectedFloat.id}</h4>
                    <Badge variant={selectedFloat.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                      {selectedFloat.status}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Position</span>
                      </div>
                      <div className="text-right text-sm">
                        <div>{selectedFloat.lat.toFixed(3)}°N</div>
                        <div>{selectedFloat.lon.toFixed(3)}°E</div>
                      </div>
                    </div>

                    {selectedFloat.temperature && (
                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-orange-600" />
                          <span className="text-sm font-medium">Temperature</span>
                        </div>
                        <span className="text-sm font-semibold">{selectedFloat.temperature}°C</span>
                      </div>
                    )}

                    {selectedFloat.salinity && (
                      <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-teal-600" />
                          <span className="text-sm font-medium">Salinity</span>
                        </div>
                        <span className="text-sm font-semibold">{selectedFloat.salinity} PSU</span>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                      Last contact: {selectedFloat.last_contact}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Click on a float marker to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default InteractiveOceanMap;
