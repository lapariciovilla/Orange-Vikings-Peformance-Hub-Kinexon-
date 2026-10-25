import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export const handler = async (event: any) => {
  // CORS Preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: "Method not allowed. Use POST." }),
    };
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          success: false,
          error: "GEMINI_API_KEY is not configured on Netlify environment variables.",
          requiresKey: true,
        }),
      };
    }

    let bodyData: any = {};
    try {
      bodyData = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "Invalid JSON request body." }),
      };
    }

    const { imageBase64, mimeType, filename, roster } = bodyData;
    if (!imageBase64) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "Image base64 data is required." }),
      };
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const rosterContext = Array.isArray(roster)
      ? roster.map((p: any) => `#${p.number?.replace(/[^0-9]/g, '')} ${p.displayName} (${p.position})`).join(", ")
      : "Ehime Orange Vikings 2026-2027 Roster";

    const promptText = `You are a specialized sports science and basketball box score OCR analyst for the Ehime Orange Vikings (B.LEAGUE).
Analyze this official basketball game box score, stat sheet, or official game report image (File: "${filename || 'gamesheet'}").

ROSTER CONTEXT:
${rosterContext}

INSTRUCTIONS:
1. Extract game metadata if visible:
   - "gameDate": ISO format "YYYY-MM-DD" (if visible on sheet, else null).
   - "opponent": Name of opponent team (e.g. "Ryukyu Golden Kings", "Saga Ballooners", etc., if visible).
   - "team": Name of team (e.g. "Ehime Orange Vikings" or "Orange Vikings").
   - "gameNumber": Game number or round if noted (e.g., "Game 1", "Round 5", or null).
2. For all players listed for the team:
   - "number": Player jersey number as string of digits (e.g., "50", "8", "1").
   - "name": Player name as printed on the sheet.
   - "minutesRaw": The exact text string from the Minutes column (e.g., "28:34", "19:12", "32:05", "00:00", "0", "DNP", "DND").
   - "minutesNumeric": Correct numeric conversion in minutes:
     * If MM:SS format like "28:34", calculate: 28 + (34 / 60) = 28.57, rounded to 1 decimal place: 28.6. NEVER write 28.34!
     * If integer format like "28", return 28.
     * If played zero minutes or "00:00", return 0.
     * If DNP (Did Not Play), DND (Did Not Dress), or not on sheet, return null. (Distinguish 0 minutes from unplayed).
   - "starter": Boolean (true if marked with an asterisk '*' or in starting 5, else false).
   - "confidence": "HIGH", "MEDIUM", or "LOW".
   - "warning": Notes about unreadable numbers or ambiguous names if any, else null.

Return STRICTLY a JSON object without markdown code blocks, backticks, or extra conversational text in this format:
{
  "gameDate": "2026-10-15",
  "opponent": "Ryukyu Golden Kings",
  "team": "Ehime Orange Vikings",
  "gameNumber": "Game 3",
  "players": [
    {
      "number": "50",
      "name": "Mitchell Watt",
      "minutesRaw": "28:34",
      "minutesNumeric": 28.6,
      "starter": true,
      "confidence": "HIGH",
      "warning": null
    }
  ],
  "warnings": []
}`;

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        promptText,
        {
          inlineData: {
            data: cleanBase64,
            mimeType: mimeType || "image/png",
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const replyText = response.text || "{}";
    const cleaned = replyText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: true,
        data: parsed,
      }),
    };
  } catch (error: any) {
    console.error("Netlify Game Sheet OCR Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to process game box score on serverless function.",
      }),
    };
  }
};
