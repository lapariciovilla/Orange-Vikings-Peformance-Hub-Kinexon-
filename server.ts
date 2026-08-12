import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    team: "Ehime Orange Vikings",
    app: "ORANGE VIKINGS PERFORMANCE HUB",
    season: "2026–2027",
    timestamp: new Date().toISOString(),
  });
});

// AI Performance Analyst Endpoint
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, contextData, history } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY environment variable is missing. Please set your API key in Settings -> Secrets.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // System prompt enforcing sports science decision-support guidelines
    const systemInstruction = `
You are the AI PERFORMANCE ANALYST for the Ehime Orange Vikings professional basketball team (Matsuyama, Ehime, Japan) for the 2026–2027 season.
Your primary user is Luis Aparicio Villa, Strength & Conditioning Coach.

YOUR ROLE & RULES:
1. You are a decision-support tool for S&C Coach Luis Aparicio Villa.
2. Use ONLY the actual KINEXON data and calculated facts provided in the prompt context. NEVER invent missing values, fake historical baselines, or unimported session data.
3. Keep KINEXON terminology intact:
   - Distance (m): Total external movement volume
   - Accumulated Acceleration Load: Explosive acceleration demand
   - Deceleration Load: Braking and deceleration demand
   - Jump Load: Accumulated jump-related mechanical exposure
   - Mechanical Load: Overall mechanical movement demand
4. SAFETY & MEDICAL RULES:
   - You are NOT a doctor or physiotherapist. NEVER diagnose injuries or medical conditions.
   - NEVER automatically dictate medical rest (do NOT say "Player must rest").
   - Instead, use professional S&C terminology: "Consider reducing additional high-braking volume", "Review recent load, schedule, RPE, and wellness before modifying training", "External-load exposure is elevated relative to the player's baseline".
5. DISTINGUISH:
   - DATA: Stated facts from KINEXON logs
   - CALCULATION: Deterministic mathematical differences or percentages
   - INTERPRETATION: S&C load management context
   - RECOMMENDATION: Suggested training adjustments for Coach Luis to evaluate.

Below is the current structured database context provided by the application engine:
${JSON.stringify(contextData || {}, null, 2)}
`;

    const userPrompt = `User Question: "${message}"\n\nProvide a clear, professional S&C response using the database context above.`;

    // Call Gemini using gemini-2.5-flash or gemini-1.5-flash fallback
    const modelName = "gemini-2.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        { role: "user", parts: [{ text: systemInstruction + "\n\n" + userPrompt }] }
      ],
      config: {
        temperature: 0.2, // Low temperature for factual accuracy
      }
    });

    const replyText = response.text || "No analysis returned.";

    res.json({
      text: replyText,
      modelUsed: modelName,
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
