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

    const promptText = `You are a specialized sports science OCR vision analyst for the Ehime Orange Vikings basketball team (B.LEAGUE).
Analyze this uploaded athlete wellness and Rate of Perceived Exertion (RPE) image, photo, or screenshot (File: "${filename || 'wellness_image'}").

ROSTER CONTEXT:
${rosterContext}

INSTRUCTIONS:
1. Infer the table layout:
   - It may be a single-date log or a multi-date weekly grid (e.g., dates as column headers Mon-Sun, athlete rows).
2. Extract all dates associated with the data cells.
   - Format all dates as strict ISO format: "YYYY-MM-DD".
   - If dates in headers only show day numbers or "8/11", "Aug 11", default to the 2026–2027 season year (2026).
3. For each cell or row containing athlete RPE/wellness data:
   - Identify the date the specific rating belongs to.
   - Extract the jersey number (string of digits e.g. "8", "50", "1") and athlete name.
   - Extract RPE score: Borg CR10 scale (numeric value between 1.0 and 10.0, e.g., 6, 7.5, 8).
     CRITICAL: If the cell is empty, blank, marked "REST", "OFF", "DNP", "INJ", or unreadable, set "rpeScore": null. NEVER invent or hallucinate missing RPE values!
   - Extract wellnessScore (1-5 scale) only if present in image, else null.
   - Extract sorenessScore (1-5 scale) only if present in image, else null.
   - Extract durationMin (minutes) only if a session duration column exists, else null.
   - Extract notes if any qualitative text is written in the cell (e.g., "Left knee sore", "Shootaround only").
   - Assess confidence: "HIGH", "MEDIUM", or "LOW".
   - Note warnings if digits are ambiguous or unreadable.

Return STRICTLY a JSON object without markdown code blocks, backticks, or extra conversational text in this format:
{
  "sheetTitle": "Morning Wellness & RPE Log",
  "detectedDates": ["2026-08-11", "2026-08-12"],
  "entries": [
    {
      "date": "2026-08-11",
      "jerseyNumber": "50",
      "playerName": "Mitchell Watt",
      "rpeScore": 7,
      "wellnessScore": 4,
      "sorenessScore": 2,
      "durationMin": 85,
      "notes": "Good session",
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
    console.error("Netlify Wellness OCR Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to process wellness image on serverless function.",
      }),
    };
  }
};
