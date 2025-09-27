// API Service Layer for FloatChat Backend Integration
// Connects to the Python backend with RAG, Database, and ARGO data processing

const API_BASE_URL = 'http://127.0.0.1:8000';

export interface ArgoFloat {
  id: string;
  lat: number;
  lon: number;
  last_contact: string;
  temperature?: number;
  salinity?: number;
  trajectory: Array<[number, number]>;
  status: 'active' | 'inactive' | 'delayed';
}

export interface ArgoProfile {
  float_id: string;
  variable: string;
  depth: number[];
  values: number[];
  timestamps: string[];
  quality_flags: number[];
}

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  actions?: ChatAction[];
}

export interface ChatAction {
  type: 'highlight' | 'compare' | 'visualize' | 'filter';
  data: any;
}

export interface RAGResponse {
  reply: string;
  actions: ChatAction[];
  sql_query?: string;
  confidence: number;
}

export interface DataFilters {
  start_date?: string;
  end_date?: string;
  lat_min?: number;
  lat_max?: number;
  lon_min?: number;
  lon_max?: number;
  variable?: 'temperature' | 'salinity' | 'oxygen';
  float_id?: string;
}

class FloatChatAPI {
  private baseUrl: string;
  private wsUrl: string;

  constructor() {
    // Configure these based on your backend deployment
    this.baseUrl = API_BASE_URL;
    this.wsUrl = 'ws://127.0.0.1:8001';
  }

  // RAG Chat System Integration
  async sendChatMessage(message: string, filters?: DataFilters): Promise<RAGResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          filters,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Chat API error:', error);
      // Return mock response for demo
      return this.getMockRAGResponse(message);
    }
  }

  // ARGO Float Data Fetching
  async getArgoFloats(filters: DataFilters = {}): Promise<ArgoFloat[]> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.baseUrl}/api/floats?${params}`);

      if (!response.ok) {
        throw new Error(`Floats API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Floats API error:', error);
      return this.getMockFloats();
    }
  }

  // Profile Data for Specific Float
  async getFloatProfile(floatId: string, variable: string = 'temperature'): Promise<ArgoProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/api/floats/${floatId}/profile?variable=${variable}`);

      if (!response.ok) {
        throw new Error(`Profile API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Profile API error:', error);
      return this.getMockProfile(floatId, variable);
    }
  }

  // Time Series Data
  async getTimeSeriesData(floatId: string, variable: string, days: number = 30): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/floats/${floatId}/timeseries?variable=${variable}&days=${days}`);

      if (!response.ok) {
        throw new Error(`Time series API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Time series API error:', error);
      return this.getMockTimeSeries(floatId);
    }
  }

  // Real-time Data Streaming
  createWebSocketConnection(onMessage: (data: any) => void, onError?: (error: Event) => void) {
    try {
      const ws = new WebSocket(`${this.wsUrl}/ws`);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        onMessage(data);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      ws.onclose = () => {
        console.log('WebSocket connection closed');
      };

      return ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
      return null;
    }
  }

  // Database Statistics
  async getDatabaseStats(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/stats`);
      return await response.json();
    } catch (error) {
      console.error('Stats API error:', error);
      return {
        total_floats: 1250,
        active_floats: 987,
        total_profiles: 45672,
        last_update: new Date().toISOString(),
      };
    }
  }

  // Data Quality Metrics
  async getDataQuality(floatId?: string): Promise<any> {
    try {
      const url = floatId
        ? `${this.baseUrl}/api/quality/${floatId}`
        : `${this.baseUrl}/api/quality`;

      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Quality API error:', error);
      return {
        overall_quality: 0.94,
        temperature_quality: 0.96,
        salinity_quality: 0.92,
        missing_data_percentage: 0.08,
      };
    }
  }

  // Export Data
  async exportData(filters: DataFilters, format: 'csv' | 'netcdf' | 'json' = 'csv'): Promise<Blob> {
    try {
      const params = new URLSearchParams({ format, ...filters } as any);
      const response = await fetch(`${this.baseUrl}/api/export?${params}`);

      if (!response.ok) {
        throw new Error(`Export API error: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export API error:', error);
      throw error;
    }
  }

  // Mock Data Methods (for development/fallback)
  private getMockRAGResponse(message: string): RAGResponse {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('temperature') || lowerMessage.includes('warm')) {
      return {
        reply: 'I found temperature data showing recent warming trends in the Arabian Sea. The average surface temperature has increased by 0.3°C over the past month.',
        actions: [
          { type: 'highlight', data: { float_ids: ['6901234', '5904321'] } },
          { type: 'visualize', data: { type: 'temperature_map' } }
        ],
        sql_query: 'SELECT * FROM argo_profiles WHERE variable = "temperature" AND lat BETWEEN 10 AND 25',
        confidence: 0.89
      };
    }

    if (lowerMessage.includes('salinity') || lowerMessage.includes('salt')) {
      return {
        reply: 'Salinity profiles show normal variations. Current surface salinity ranges from 35.2 to 35.8 PSU in the specified region.',
        actions: [
          { type: 'compare', data: { float_ids: ['6901234', '7905678'] } }
        ],
        confidence: 0.92
      };
    }

    return {
      reply: 'I can help you analyze ARGO float data. Try asking about temperature profiles, salinity trends, or specific float locations.',
      actions: [],
      confidence: 0.75
    };
  }

  private getMockFloats(): ArgoFloat[] {
    return [
      {
        id: '6901234',
        lat: 15.5,
        lon: 68.2,
        last_contact: '2024-01-15T10:30:00Z',
        temperature: 28.5,
        salinity: 35.4,
        trajectory: [[15.1, 67.9], [15.3, 68.0], [15.5, 68.2]],
        status: 'active'
      },
      {
        id: '5904321',
        lat: 8.1,
        lon: 72.3,
        last_contact: '2024-01-14T15:45:00Z',
        temperature: 29.2,
        salinity: 35.1,
        trajectory: [[7.8, 72.0], [7.9, 72.1], [8.1, 72.3]],
        status: 'active'
      },
      {
        id: '7905678',
        lat: -2.1,
        lon: 85.6,
        last_contact: '2024-01-13T08:20:00Z',
        temperature: 27.8,
        salinity: 35.7,
        trajectory: [[-2.4, 85.3], [-2.2, 85.4], [-2.1, 85.6]],
        status: 'delayed'
      }
    ];
  }

  private getMockProfile(floatId: string, variable: string): ArgoProfile {
    const depths = [0, 10, 20, 50, 100, 200, 500, 1000, 1500, 2000];
    let values: number[] = [];

    switch (variable) {
      case 'temperature':
        values = [28.5, 28.2, 27.8, 26.5, 24.2, 18.5, 8.2, 4.1, 2.8, 2.1];
        break;
      case 'salinity':
        values = [35.1, 35.2, 35.3, 35.4, 35.5, 35.3, 34.8, 34.6, 34.7, 34.8];
        break;
      case 'oxygen':
        values = [245, 240, 235, 210, 180, 150, 120, 100, 90, 85];
        break;
      default:
        values = depths.map(() => Math.random() * 100);
    }

    return {
      float_id: floatId,
      variable,
      depth: depths,
      values,
      timestamps: depths.map((_, i) => new Date(Date.now() - i * 3600000).toISOString()),
      quality_flags: depths.map(() => 1) // 1 = good quality
    };
  }

  private getMockTimeSeries(floatId: string): any {
    const now = new Date();
    const data = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        timestamp: date.toISOString(),
        temperature: 28 + Math.random() * 2 - 1,
        salinity: 35 + Math.random() * 0.5 - 0.25,
        depth: Math.random() * 50
      });
    }

    return { float_id: floatId, data };
  }
}

export const floatChatAPI = new FloatChatAPI();
export default floatChatAPI;
