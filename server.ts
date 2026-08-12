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
2. Use ONLY the actual KINEXON data and calculated facts provided in the prompt context. NEVER invent missing values or fake historical baselines.
3. Keep KINEXON terminology intact: Distance (m), Accumulated Acceleration Load, Deceleration Load, Jump Load, Mechanical Load.
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
