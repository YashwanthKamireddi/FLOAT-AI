// This file contains helper utility functions for the frontend.

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// This is the standard utility function needed by shadcn/ui components.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type RawBackendResult = Record<string, unknown>[] | string | null;

const coerceToNumberIfPossible = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? value : numericValue;
};

/**
 * Normalizes the database payload coming from the backend into a typed array of objects.
 * Handles both structured arrays (preferred) and legacy stringified tuples.
 */
export const parseSqlResult = (
  sqlQuery: string | null,
  rawResult: RawBackendResult,
): Record<string, any>[] => {
  if (!sqlQuery || rawResult == null) {
    return [];
  }

  if (Array.isArray(rawResult)) {
    return rawResult
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const normalisedRow: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          normalisedRow[key] = coerceToNumberIfPossible(value);
        });
        return normalisedRow;
      });
  }

  const resultString = rawResult.trim();
  if (!resultString || resultString === "[]") {
    return [];
  }

  try {
    const match = sqlQuery.match(/SELECT\s+(.*?)\s+FROM/is);
    if (!match) return [];

    const columns = match[1].split(",").map((columnDefinition) => {
      const parts = columnDefinition.trim().split(/\s+/);
      return parts[parts.length - 1].replace(/["'`]/g, "");
    });

    const validJsonString = resultString
      .replace(/\(/g, "[")
      .replace(/\)/g, "]")
      .replace(/'/g, '"')
      .replace(/datetime\.datetime\([^)]+\)/g, (matchValue) => `"${matchValue}"`);

    const data = JSON.parse(validJsonString);

    return data.map((row: unknown[]) => {
      const rowObject: Record<string, any> = {};
      columns.forEach((col, index) => {
        const value = row[index];
        rowObject[col] = coerceToNumberIfPossible(value as unknown);
      });
      return rowObject;
    });
  } catch (error) {
    console.error("Error parsing SQL result:", error);
    return [];
  }
};
