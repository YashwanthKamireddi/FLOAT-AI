import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Layers, Zap, Thermometer } from 'lucide-react';

// Mock ARGO float data
const mockArgoFloats = [
  { id: 'A001', lat: 15.5, lon: 68.2, status: 'Active', lastContact: '2024-01-20', temperature: 24.5 },
  { id: 'A002', lat: 12.8, lon: 70.1, status: 'Active', lastContact: '2024-01-21', temperature: 26.1 },
  { id: 'A003', lat: 18.2, lon: 65.7, status: 'Inactive', lastContact: '2024-01-15', temperature: 23.8 },
  { id: 'A004', lat: 20.1, lon: 69.8, status: 'Active', lastContact: '2024-01-21', temperature: 25.2 },
  { id: 'A005', lat: 14.3, lon: 72.5, status: 'Active', lastContact: '2024-01-20', temperature: 27.3 },
];

const OceanMap = () => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // In a real implementation, this would initialize a mapping library like Leaflet or Mapbox
    console.log('Map component mounted - would initialize real map here');
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Map Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-surface">
        <div className="flex items-center space-x-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Ocean Map
          </h3>
          <Badge variant="secondary">
            {mockArgoFloats.filter(f => f.status === 'Active').length} Active Floats
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Layers className="w-4 h-4 mr-1" />
            Layers
          </Button>
          <Button variant="outline" size="sm">
            <Zap className="w-4 h-4 mr-1" />
            Real-time
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative bg-gradient-to-b from-blue-50 to-blue-100">
        <div 
          ref={mapRef} 
          className="w-full h-full relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-200 via-blue-300 to-blue-500"
        >
          {/* Simulated Ocean Background */}
          <div className="absolute inset-0 opacity-30">
            <div className="w-full h-full bg-gradient-radial from-transparent via-blue-400/20 to-blue-600/40 animate-wave"></div>
          </div>

          {/* Mock ARGO Float Markers */}
          <div className="relative w-full h-full">
            {mockArgoFloats.map((float) => {
              const x = ((float.lon - 60) / 20) * 100; // Convert lon to percentage
              const y = ((25 - float.lat) / 15) * 100;   // Convert lat to percentage
              
              return (
                <div
                  key={float.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {/* Float Marker */}
                  <div 
                    className={`w-4 h-4 rounded-full border-2 border-white shadow-lg animate-pulse ${
                      float.status === 'Active' 
                        ? 'bg-accent' 
                        : 'bg-muted-foreground'
                    }`}
                  />
                  
                  {/* Hover Card */}
                  <Card className="absolute bottom-6 left-1/2 transform -translate-x-1/2 p-2 bg-card/95 backdrop-blur-sm shadow-ocean opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-[200px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{float.id}</span>
                        <Badge 
                          variant={float.status === 'Active' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {float.status}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Lat: {float.lat}°, Lon: {float.lon}°</div>
                        <div className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3" />
                          {float.temperature}°C
                        </div>
                        <div className="text-muted-foreground">
                          Last: {float.lastContact}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm p-3 rounded-lg shadow-ocean">
            <h4 className="font-semibold text-sm mb-2">ARGO Floats</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent border border-white"></div>
                <span>Active</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground border border-white"></div>
                <span>Inactive</span>
              </div>
            </div>
          </div>

          {/* Coordinates Display */}
          <div className="absolute top-4 right-4 bg-card/90 backdrop-blur-sm p-2 rounded-lg shadow-ocean">
            <div className="text-xs space-y-1">
              <div className="font-semibold">Indian Ocean</div>
              <div className="text-muted-foreground">
                10°N - 25°N, 60°E - 80°E
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map Footer */}
      <div className="p-3 border-t bg-gradient-surface text-xs text-muted-foreground">
        <div className="flex justify-between items-center">
          <span>Interactive ocean map showing ARGO float positions</span>
          <span>Data: INCOIS • Updated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default OceanMap;