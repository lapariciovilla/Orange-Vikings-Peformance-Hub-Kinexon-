import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export interface GeminiVisionOptions {
  apiKey: string;
  imageBase64: string;
  mimeType?: string;
  promptText: string;
  timeoutMs?: number; // default 22,000ms (fits inside Netlify 26s limit)
  maxRetries?: number; // default 3
}

export interface GeminiVisionResult {
  data: any;
  modelUsed: string;
  attempts: number;
}

// Sleep with jitter
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Robust server-side Gemini Vision caller with:
 * 1. Low thinking latency configuration (ThinkingLevel.LOW)
 * 2. Automatic retries on 429, 502, 503 (model overloaded), 504 (timeout)
 * 3. Exponential backoff with random jitter
 * 4. Transparent fallback from gemini-3.8-flash to gemini-3.1-flash-lite if primary is overloaded
 * 5. Clean JSON parsing and Markdown block stripping
 */
export async function analyzeImageWithGemini(
  options: GeminiVisionOptions
): Promise<GeminiVisionResult> {
  const {
    apiKey,
    imageBase64,
    mimeType = "image/png",
    promptText,
    timeoutMs = 22000,
    maxRetries = 3,
  } = options;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required.");
  }
  if (!imageBase64) {
    throw new Error("Image base64 data is required.");
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Candidate models: Primary is gemini-3.8-flash, fallback is gemini-3.1-flash-lite
  const candidateModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];

  let lastError: any = null;
  let totalAttempts = 0;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      totalAttempts++;
      try {
        // Enforce timeout using Promise.race
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            const err: any = new Error(
              `Gemini Vision inference timed out after ${Math.round(timeoutMs / 1000)}s on ${model}`
            );
            err.status = 504;
            reject(err);
          }, timeoutMs);
        });

        const generatePromise = (async () => {
          const config: any = {
            responseMimeType: "application/json",
            temperature: 0.1,
          };

          // Configure ThinkingLevel.LOW for Gemini 3 models to prevent 40s reasoning hangs
          if (model.startsWith("gemini-3")) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const response = await ai.models.generateContent({
            model,
            contents: [
              promptText,
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType || "image/png",
                },
              },
            ],
            config,
          });

          return response;
        })();

        const response = await Promise.race([generatePromise, timeoutPromise]);
        const replyText = response.text || "{}";
        const cleaned = replyText
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();

        try {
          const parsed = JSON.parse(cleaned);
          return {
            data: parsed,
            modelUsed: model,
            attempts: totalAttempts,
          };
        } catch (jsonErr: any) {
          console.warn(
            `[GeminiVision] Model ${model} returned unparseable JSON (attempt ${attempt}):`,
            replyText.substring(0, 200)
          );
          // If JSON parse fails, throw to retry
          const err: any = new Error("Failed to parse structured JSON from vision model.");
          err.status = 422;
          err.rawText = replyText;
          throw err;
        }
      } catch (err: any) {
        lastError = err;
        const status = err.status || (err.error && err.error.code) || 500;
        const msg = err.message || "";
        console.warn(
          `[GeminiVision] Attempt ${attempt}/${maxRetries} failed on ${model} (HTTP ${status}): ${msg}`
        );

        // Check if error is permanent (e.g. 400 Invalid Argument, 401/403 Bad Key)
        const isPermanent = status === 400 || status === 401 || status === 403 || status === 413;
        if (isPermanent) {
          throw err; // Do not retry permanent errors
        }

        // Check if error is retryable (429 Rate Limit, 502 Bad Gateway, 503 Overload, 504 Timeout)
        const isRetryable =
          status === 429 ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          status === 422 ||
          msg.includes("high demand") ||
          msg.includes("timed out") ||
          msg.includes("fetch failed");

        if (!isRetryable && attempt >= 2) {
          break; // Try fallback model
        }

        // If this model has attempts left, back off with jitter and retry
        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * Math.pow(1.8, attempt - 1) + Math.random() * 500, 5000);
          console.log(`[GeminiVision] Retrying in ${Math.round(backoff)}ms...`);
          await wait(backoff);
        }
      }
    }

    console.warn(`[GeminiVision] Primary model ${model} exhausted attempts, switching to fallback model if available...`);
  }

  // All models and retries exhausted
  throw lastError || new Error("Failed to extract data after multiple retries and model fallbacks.");
}
