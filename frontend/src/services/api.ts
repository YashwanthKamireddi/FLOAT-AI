// This file contains the function for communicating with our Python AI backend.

const API_URL = "http://127.0.0.1:8000/api/ask";

// This interface defines the "API Contract". It's the exact shape of the
// JSON object that our Python backend will send back.
export interface AIResponse {
  sql_query: string | null;
  // CRITICAL: The data from the backend is now either a structured array of objects
  // for data queries, or a simple string for conversational replies.
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

    return await response.json();

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

