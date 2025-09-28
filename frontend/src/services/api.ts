// This file contains the function for communicating with our Python AI backend.

const resolveApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    const normalizedProtocol = protocol === "file:" ? "http:" : protocol;

    const sanitizedHost = hostname === "::1" ? "127.0.0.1" : hostname;

    if (sanitizedHost === "localhost" || sanitizedHost === "127.0.0.1") {
      return "http://127.0.0.1:8000/api/ask";
    }

    return `${normalizedProtocol}//${sanitizedHost}:8000/api/ask`;
  }

  return "http://127.0.0.1:8000/api/ask";
};

const API_URL = resolveApiUrl();

// This interface defines the "API Contract".
export interface AIResponse {
  sql_query: string | null;
  // CRITICAL CHANGE: The data from the backend is now a proper array of objects
  // or a simple string for conversational replies.
  result_data: Record<string, any>[] | string | null;
  error: string | null;
}

/**
 * Sends a question to the FloatChat AI backend.
 * @param question The user's question as a string.
 * @returns A promise that resolves to the AI's response payload.
 */
export const askAI = async (question: string): Promise<AIResponse> => {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const payload = await response.json();
    return payload as AIResponse;

  } catch (error) {
    console.error("Failed to fetch from AI backend:", error);
    // Return a structured error so the UI can handle it gracefully
    return {
      sql_query: "Error connecting to backend.",
      result_data: null,
      error: "Could not connect to the AI server. Is it running?",
    };
  }
};
