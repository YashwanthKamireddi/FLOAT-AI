// This file contains helper utility functions for the frontend.

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

// This is the standard utility function needed by shadcn/ui components.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses the raw string result from the database into an array of objects.
 * It cleverly extracts the column names from the SQL query itself.
 */
export const parseSqlResult = (sqlQuery: string | null, resultString: string | null): Record<string, any>[] => {
  // Gracefully handle empty or null inputs
  if (!resultString || !sqlQuery || resultString.trim() === "[]") {
    return [];
  }
  try {
    // Use a regular expression to extract the column names from the SELECT clause
    const match = sqlQuery.match(/SELECT\s+(.*?)\s+FROM/is);
    if (!match) return [];
    
    // Clean up the extracted column names, handling aliases (e.g., "AVG(temp) as average_temp")
    const columns = match[1].split(',').map(c => {
        const parts = c.trim().split(/\s+/);
        // The last word in the split is the column name or its alias
        return parts[parts.length - 1].replace(/["'`]/g, '');
    });
    
    // The backend sends a string like '[ (val1, datetime.datetime(...)), ...]'
    // This is not valid JSON. We need to convert it.
    const validJsonString = resultString
      .replace(/\(/g, '[') // Convert tuples to arrays
      .replace(/\)/g, ']')
      .replace(/'/g, '"') // Convert single quotes to double quotes
      // Convert python datetime objects into a simple string so JSON can parse it
      .replace(/datetime\.datetime\([^)]+\)/g, (match) => `"${match}"`);
    
    const data = JSON.parse(validJsonString);
    
    // Combine the column names with the data to create an array of objects
    return data.map((row: any[]) => {
      const obj: Record<string, any> = {};
      columns.forEach((col, i) => {
        const value = row[i];
        // Attempt to convert to number if possible, otherwise keep as string
        obj[col] = (typeof value === 'string' && !isNaN(Number(value))) ? Number(value) : value;
      });
      return obj;
    });
  } catch (error) {
    console.error("Error parsing SQL result:", error);
    return []; // Return an empty array on any parsing error to prevent crashes
  }
};

