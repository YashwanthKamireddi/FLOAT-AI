import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EnhancedChatInterface from './EnhancedChatInterface';
import RealTimeOceanMap from './RealTimeOceanMap';
import StreamingDataVisualization from './StreamingDataVisualization';
import { Waves, MessageCircle, Map, BarChart3, Satellite, Database, Activity } from 'lucide-react';
import { floatChatAPI } from '@/services/api';

const FloatChatDashboard = () => {
  console.log('FloatChatDashboard rendering...');

  const [activeTab, setActiveTab] = useState('map');
  const [dataFilters, setDataFilters] = useState({});
  const [highlightedFloats, setHighlightedFloats] = useState<string[]>([]);
  const [dbStats, setDbStats] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Load database statistics on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await floatChatAPI.getDatabaseStats();
        setDbStats(stats);
        setIsConnected(true);
      } catch (error) {
        console.error('Failed to load database stats:', error);
        setIsConnected(false);
      }
    };

    loadStats();
    // Refresh stats every 5 minutes
    const interval = setInterval(loadStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle actions from chat interface
  const handleDataAction = (action: any) => {
    switch (action.type) {
      case 'highlight':
        if (action.data.float_ids) {
          setHighlightedFloats(action.data.float_ids);
          setActiveTab('map'); // Switch to map to show highlights
        }
        break;
      case 'compare':
        if (action.data.float_ids) {
          setHighlightedFloats(action.data.float_ids);
          setActiveTab('data'); // Switch to data visualization
        }
        break;
      case 'visualize':
        setActiveTab('data');
        break;
      case 'filter':
        setDataFilters(action.data);
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-orange-50 to-teal-50 overflow-hidden">
      {/* Compact Modern Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 glass-effect bg-white/80 backdrop-blur-md">
        <div className="w-full px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-teal-500 to-orange-500 flex items-center justify-center shadow-lg border border-blue-300">
                  <Waves className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <h1 className="text-2xl font-black bg-gradient-to-r from-blue-600 via-teal-600 to-orange-600 bg-clip-text text-transparent tracking-tight">
                  FloatChat
                </h1>
                <p className="text-xs text-gray-600 font-semibold tracking-wide">
                  🌊 OCEANOGRAPHIC RESEARCH PLATFORM
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center space-x-2 shadow-md border border-blue-200">
                <Database className="w-4 h-4 text-blue-600" />
                <div>
                  <span className="text-sm font-bold text-gray-800">
                    {dbStats ? `${dbStats.total_floats}` : '...'}
                  </span>
                  <p className="text-xs text-gray-600 font-medium">FLOATS</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Full Width Main Content */}
      <main className="w-full h-[calc(100vh-4rem)]">
        <div className="w-full h-full flex flex-col lg:flex-row">
          {/* Enhanced Chat Panel - Perfectly Aligned */}
          <div className="w-full lg:w-1/3 h-full p-3">
            <div className="h-full bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-blue-200">
              <EnhancedChatInterface
                onDataAction={handleDataAction}
                filters={dataFilters}
              />
            </div>
          </div>

          {/* Visualization Panel - Perfectly Aligned */}
          <div className="w-full lg:w-2/3 h-full p-3 pl-0">
            <div className="h-full flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-blue-200 overflow-hidden">
              <div className="px-6 py-3 border-b border-blue-200 bg-white/90">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full max-w-md h-12 p-1 bg-white/90 rounded-xl shadow-md border border-blue-200">
                    <TabsTrigger value="map" className="rounded-lg text-sm font-bold transition-all text-blue-700 hover:bg-blue-100 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                      <Map className="w-4 h-4 mr-2" />
                      🗺️ OCEAN
                    </TabsTrigger>
                    <TabsTrigger value="data" className="rounded-lg text-sm font-bold transition-all text-teal-700 hover:bg-teal-100 data-[state=active]:bg-teal-500 data-[state=active]:text-white">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      📊 DATA
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
                  <TabsContent value="map" className="h-full mt-0 p-4">
                    <div className="h-full w-full overflow-hidden rounded-lg">
                      <RealTimeOceanMap
                        filters={dataFilters}
                        highlightedFloats={highlightedFloats}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="data" className="h-full mt-0 p-4">
                    <div className="h-full w-full overflow-hidden rounded-lg">
                      <StreamingDataVisualization
                        filters={dataFilters}
                        highlightedFloats={highlightedFloats}
                      />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FloatChatDashboard;
