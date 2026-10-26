import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { analyzeImageWithGemini } from "./src/server/geminiVision";

const app = express();
const PORT = 3000;

// Enable CORS for all incoming client requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Log API routes for observability
app.use("/api", (req, res, next) => {
  console.log(`[API ${req.method}] ${req.originalUrl}`);
  next();
});

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    team: "Ehime Orange Vikings",
    app: "ORANGE VIKINGS PERFORMANCE HUB",
    season: "2026–2027",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Check AI status
app.get("/api/ai/status", (req, res) => {
  res.json({
    configured: Boolean(process.env.GEMINI_API_KEY),
    model: "gemini-3.8-flash",
  });
});

// -------------------------------------------------------------
// Wellness & RPE Vision OCR Endpoint
// -------------------------------------------------------------
app.post("/api/ai/parse-wellness-image", async (req, res) => {
  try {
    const { imageBase64, mimeType, filename, roster } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "GEMINI_API_KEY is not configured on the server environment.",
        requiresKey: true,
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "Image base64 data is required." });
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

    const result = await analyzeImageWithGemini({
      apiKey,
      imageBase64,
      mimeType,
      promptText,
      timeoutMs: 22000,
      maxRetries: 3,
    });

    return res.json({
      success: true,
      data: result.data,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    });
  } catch (error: any) {
    console.error("Wellness / RPE Vision OCR Error:", error);
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: error.message || "Failed to process wellness image",
      rawText: error.rawText || undefined,
    });
  }
});

// -------------------------------------------------------------
// Game Sheet / Box Score Vision OCR Endpoint (Basketball Minutes)
// -------------------------------------------------------------
app.post("/api/ai/parse-gamesheet", async (req, res) => {
  try {
    const { imageBase64, mimeType, filename, roster } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "GEMINI_API_KEY is not configured on the server environment.",
        requiresKey: true,
      });
    }

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "Image base64 data is required." });
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

    const result = await analyzeImageWithGemini({
      apiKey,
      imageBase64,
      mimeType,
      promptText,
      timeoutMs: 22000,
      maxRetries: 3,
    });

    return res.json({
      success: true,
      data: result.data,
      modelUsed: result.modelUsed,
      attempts: result.attempts,
    });
  } catch (error: any) {
    console.error("Game Sheet OCR Error:", error);
    const status = error.status || 500;
    res.status(status).json({
      success: false,
      error: error.message || "Failed to parse game sheet image",
      rawText: error.rawText || undefined,
    });
  }
});

// AI Performance Analyst Endpoint
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, contextData } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = "gemini-3.6-flash";

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const systemInstruction = `
You are the AI PERFORMANCE ANALYST for the Ehime Orange Vikings professional basketball team (Matsuyama, Ehime, Japan) for the 2026–2027 season.
Your primary user is Luis Aparicio Villa, Strength & Conditioning Coach.

YOUR ROLE & RULES:
1. You are a decision-support tool for S&C Coach Luis Aparicio Villa.
2. Use ONLY the actual tracking data and calculated facts provided in the prompt context. NEVER invent missing values or fake historical baselines.
3. Keep core metric terminology intact: Distance (m), Accumulated Acceleration Load, Deceleration Load, Jump Load, Mechanical Load.
4. SAFETY & MEDICAL RULES: Never diagnose injuries. Never dictate medical rest. Use professional S&C advice ("Consider monitoring volume", "Review recent load and RPE").
5. Format response with clear section headings, bullet points, and high contrast stats.

Database Context:
${JSON.stringify(contextData || {}, null, 2)}
`;

        const userPrompt = `User Question: "${message}"\n\nProvide a concise, professional S&C response using the database context above.`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            { role: "user", parts: [{ text: systemInstruction + "\n\n" + userPrompt }] },
          ],
          config: {
            temperature: 0.2,
          },
        });

        const replyText = response.text;
        if (replyText) {
          return res.json({
            text: replyText,
            modelUsed: modelName,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (geminiError: any) {
        console.warn("Gemini API call failed, switching to local S&C engine:", geminiError.message);
      }
    }

    // Fallback: Smart S&C Decision Engine when API Key is missing or rate limited
    const replyText = generateLocalAnalysis(message, contextData);

    return res.json({
      text: replyText,
      modelUsed: "S&C Rule-Based Local Engine",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      error: "Failed to generate AI performance analysis",
      details: error.message || String(error),
    });
  }
});

function generateLocalAnalysis(query: string, contextData: any): string {
  const records = contextData?.latestRecords || [];
  const q = query.toLowerCase();

  if (records.length === 0) {
    return "No active session records found in the database. Please import or select a session to perform performance analysis.";
  }

  if (q.includes("distance")) {
    const sorted = [...records].sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));
    const top = sorted[0];
    const top3 = sorted.slice(0, 3);
    return `### 📊 Distance Exposure Analysis (KINEXON)
- **Top Distance Performer:** #${top.player_number} ${top.player_name} (${top.position}) with **${top.distance_m?.toLocaleString()} meters**.
- **Top 3 Volume Performers:**
${top3.map((p, i) => `  ${i + 1}. #${p.player_number} ${p.player_name}: ${p.distance_m?.toLocaleString()} m`).join("\n")}

**S&C Recommendation for Coach Luis:**
- #${top.player_number} ${top.player_name} completed high total displacement. Check post-session RPE and ensure adequate lower-limb recovery before tomorrow's shootaround.`;
  }

  if (q.includes("mechanical load") || q.includes("mechanical")) {
    const sorted = [...records].sort((a, b) => (b.mechanical_load || 0) - (a.mechanical_load || 0));
    const top = sorted[0];
    return `### ⚡ Mechanical Load Analysis
- **Highest Mechanical Load:** #${top.player_number} ${top.player_name} (${top.position}) with a value of **${top.mechanical_load}**.
- **Team Average Mechanical Load:** ${(records.reduce((acc: number, r: any) => acc + (r.mechanical_load || 0), 0) / records.length).toFixed(1)}

**S&C Context:**
Mechanical load integrates total force demands across accelerations, decelerations, and jumps. #${top.player_number} ${top.player_name}'s elevated mechanical exposure warrants close tendon readiness monitoring.`;
  }

  if (q.includes("deceleration") || q.includes("braking")) {
    const sorted = [...records].sort((a, b) => (b.deceleration_load || 0) - (a.deceleration_load || 0));
    return `### 🛑 Deceleration Load Rankings (Braking Demand)
${sorted.map((p, i) => `${i + 1}. **#${p.player_number} ${p.player_name}** (${p.position}): **${p.deceleration_load}** decel load`).join("\n")}

**Sports Science Note:**
Deceleration demands produce peak eccentric knee-extensor loading. Players at the top of this list benefit from post-session patellar isometric holds or soft-tissue recovery protocols.`;
  }

  if (q.includes("aoki") || q.includes("kodama") || q.includes("compare")) {
    const aoki = records.find((r: any) => r.player_name.toLowerCase().includes("aoki"));
    const kodama = records.find((r: any) => r.player_name.toLowerCase().includes("kodama"));

    if (aoki && kodama) {
      return `### ⚔️ Player Comparison: Ryuji Aoki vs. Hiroaki Kodama
- **Distance (m):** Aoki: **${aoki.distance_m} m** | Kodama: **${kodama.distance_m} m**
- **Acceleration Load:** Aoki: **${aoki.accumulated_acceleration_load}** | Kodama: **${kodama.accumulated_acceleration_load}**
- **Deceleration Load:** Aoki: **${aoki.deceleration_load}** | Kodama: **${kodama.deceleration_load}**
- **Jump Load:** Aoki: **${aoki.jump_load}** | Kodama: **${kodama.jump_load}**
- **Mechanical Load:** Aoki: **${aoki.mechanical_load}** | Kodama: **${kodama.mechanical_load}**

**Coach Luis Summary:**
${aoki.distance_m > kodama.distance_m ? `Aoki covered ${aoki.distance_m - kodama.distance_m}m more total distance` : `Kodama covered ${kodama.distance_m - aoki.distance_m}m more total distance`}. Review playing time or drill intensity to contextualize these differences.`;
    }
  }

  if (q.includes("jump")) {
    const sorted = [...records].sort((a, b) => (b.jump_load || 0) - (a.jump_load || 0));
    const top = sorted[0];
    return `### 🦘 Jump Exposure Breakdown
- **Highest Jump Load:** #${top.player_number} ${top.player_name} (${top.position}) at **${top.jump_load}**.
- **Top Jumpers in Session:**
${sorted.slice(0, 4).map((p, i) => `  ${i + 1}. #${p.player_number} ${p.player_name}: ${p.jump_load}`).join("\n")}

**S&C Recommendation:**
Keep track of vertical impact accumulators, particularly for frontcourt athletes. Consider isometric tendon stiffness exercises.`;
  }

  // Default summary response
  const sortedDist = [...records].sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));
  const topP = sortedDist[0];
  return `### 🏀 Orange Vikings Performance Overview
- **Session Monitored:** ${contextData?.latestSession?.session_name || "Latest Session"} (${contextData?.latestSession?.date || "2026-08-11"})
- **Active Roster Tracked:** ${records.length} players
- **Peak Volume Athlete:** #${topP?.player_number} ${topP?.player_name} (${topP?.distance_m?.toLocaleString()} m)
- **Team Total Distance:** ${(records.reduce((a: number, r: any) => a + (r.distance_m || 0), 0) / 1000).toFixed(2)} km

How else can I assist with S&C load management or player comparison analytics for Coach Luis?`;
}

async function startServer() {
  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Orange Vikings Performance Hub running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
