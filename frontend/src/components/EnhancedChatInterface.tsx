import { useCallback, useEffect, useMemo, useState } from 'react';
import ChatInterface from './ChatInterface';

export type DataActionType =
  | 'highlight'
  | 'compare'
  | 'visualize'
  | 'filter'
  | 'status'
  | 'complexity';

export interface DataActionPayload {
  type: DataActionType;
  data: Record<string, unknown>;
}

interface EnhancedChatInterfaceProps {
  onDataAction: (action: DataActionPayload) => void;
  filters?: Record<string, unknown>;
}

const buildFilterSynopsis = (filters?: Record<string, unknown>): string | null => {
  if (!filters || Object.keys(filters).length === 0) {
    return null;
  }

  const parts = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: ${value.join(', ')}`;
      }
      if (typeof value === 'object') {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${String(value)}`;
    });

  if (parts.length === 0) {
    return null;
  }

  return `Focus on ${parts.join(' | ')}`;
};

const extractFloatIdentifiers = (rows: Record<string, unknown>[]): string[] => {
  const candidateKeys = ['float_id', 'floatId', 'id', 'profile_id', 'profileId'];

  const identifiers = new Set<string>();
  rows.forEach((row) => {
    if (!row || typeof row !== 'object') {
      return;
    }

    candidateKeys.forEach((key) => {
      const value = row[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        identifiers.add(value.trim());
      }
    });
  });

  return Array.from(identifiers);
};

const EnhancedChatInterface = ({ onDataAction, filters }: EnhancedChatInterfaceProps) => {
  const [palettePrefill, setPalettePrefill] = useState<string | null>(null);

  const handleDataReceived = useCallback(
    (rows: Record<string, unknown>[], sqlQuery: string) => {
      const payload = {
        rows,
        sqlQuery,
      };

      onDataAction({
        type: 'visualize',
        data: payload,
      });

      const floatIds = extractFloatIdentifiers(rows);
      if (floatIds.length > 0) {
        onDataAction({
          type: 'highlight',
          data: {
            float_ids: floatIds,
            rows,
          },
        });
      }
    },
    [onDataAction],
  );

  const handleComplexitySignal = useCallback(
    (delta: number, query: string) => {
      onDataAction({
        type: 'complexity',
        data: {
          delta,
          query,
        },
      });
    },
    [onDataAction],
  );

  const handleBackendStatusChange = useCallback(
    (status: string, detail?: string) => {
      onDataAction({
        type: 'status',
        data: {
          status,
          detail,
        },
      });
    },
    [onDataAction],
  );

  const handlePrefillConsumed = useCallback(() => {
    setPalettePrefill(null);
  }, []);

  useEffect(() => {
    const synopsis = buildFilterSynopsis(filters);
    if (!synopsis) {
      return;
    }

    setPalettePrefill((previous) => {
      if (previous === synopsis) {
        return previous;
      }
      return synopsis;
    });
  }, [filters]);

  const memoisedFilters = useMemo(() => filters ?? {}, [filters]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-white/40 bg-white/60 px-4 py-2 text-xs text-muted-foreground">
        {Object.keys(memoisedFilters).length > 0 ? (
          <span>
            Active filters:&nbsp;
            {Object.entries(memoisedFilters)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
              .join(' · ')}
          </span>
        ) : (
          <span>No active filters — ask FloatAI for guidance.</span>
        )}
      </div>
      <div className="flex-1">
        <ChatInterface
          onDataReceived={handleDataReceived}
          onComplexitySignal={handleComplexitySignal}
          dataSummary={null}
          palettePrefill={palettePrefill}
          onPrefillConsumed={handlePrefillConsumed}
          onBackendStatusChange={handleBackendStatusChange}
        />
      </div>
    </div>
  );
};

export default EnhancedChatInterface;
