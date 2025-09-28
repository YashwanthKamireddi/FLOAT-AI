// This is the main orchestrator for your entire frontend application.
// It now includes the ThemeToggle button in the header.

import { useState, useEffect } from 'react';
import ChatInterface from '@/components/ChatInterface';
import DataVisualization from '@/components/DataVisualization';
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle"; // <-- IMPORT THE TOGGLE
import { askAI } from '@/services/api';
import { parseSqlResult } from '@/lib/utils';

export interface AppData {
  data: Record<string, any>[];
  sqlQuery: string;
}

function App() {
  const [appData, setAppData] = useState<AppData>({ data: [], sqlQuery: "" });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch a welcome map on the first load
  useEffect(() => {
    const fetchInitialData = async () => {
      const initialQuestion = "Show me the location of 100 recent floats.";
      const response = await askAI(initialQuestion);
      if (response && !response.error && Array.isArray(response.result_data)) {
        setAppData({ data: response.result_data, sqlQuery: response.sql_query || "" });
      }
      setIsLoading(false);
    };
    fetchInitialData();
  }, []);

  const handleDataReceived = (data: Record<string, any>[], sqlQuery: string) => {
    setAppData({ data, sqlQuery });
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <main className="h-screen w-screen bg-muted/20 flex flex-col text-base">
        {/* --- The header now contains the ThemeToggle button --- */}
        <header className="p-4 border-b text-center bg-card/50 flex justify-between items-center">
          <h1 className="text-3xl font-bold">🌊 FloatChat - ARGO Explorer</h1>
          <ThemeToggle />
        </header>
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
          
          <div className="lg:col-span-1 h-full overflow-hidden rounded-lg shadow-lg border">
            <ChatInterface onDataReceived={handleDataReceived} />
          </div>

          <div className="lg:col-span-2 h-full overflow-hidden rounded-lg shadow-lg border bg-card">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">Loading initial map of float locations...</p>
              </div>
            ) : (
              <DataVisualization data={appData.data} sqlQuery={appData.sqlQuery} />
            )}
          </div>

        </div>
      </main>
    </ThemeProvider>
  );
}

export default App;

