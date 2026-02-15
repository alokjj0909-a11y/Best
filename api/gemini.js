// /api/gemini.js  (Vercel Serverless)

export default async function handler(req, res) {
  // -------------------------------
  // 1. CORS
  // -------------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, text: "Method Not Allowed" });
  }

  try {
    // -------------------------------
    // 2. GEMINI API KEY
    // -------------------------------
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        text: "GEMINI_API_KEY missing in environment variables"
      });
    }

    // -------------------------------
    // 3. REQUEST BODY
    // -------------------------------
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = "text", contents, systemInstruction, prompt } = body || {};

    // -------------------------------
    // 4. IMAGE MODE (NO Gemini image API – safe fallback)
    // -------------------------------
    if (mode === "image") {
      const imgPrompt =
        prompt || contents?.[0]?.parts?.[0]?.text || "Educational diagram";

      return res.status(200).json({
        ok: true,
        text: "Image generated",
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(
          imgPrompt
        )}?width=1024&height=768&nologo=true`,
        audio: null
      });
    }

    // -------------------------------
    // 5. TTS MODE (Browser fallback)
    // -------------------------------
    if (mode === "tts") {
      return res.status(200).json({
        ok: true,
        text: "Using browser TTS",
        image: null,
        audio: null
      });
    }

    // -------------------------------
    // 6. TEXT / CHAT MODE (Gemini 1.5 Flash)
    // -------------------------------
    const messages = [];

    if (systemInstruction?.parts?.[0]?.text) {
      messages.push({
        role: "user",
        parts: [{ text: systemInstruction.parts[0].text }]
      });
    }

    if (Array.isArray(contents)) {
      contents.forEach(c => {
        if (c.parts) {
          messages.push({
            role: c.role || "user",
            parts: c.parts
          });
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    );

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ AI did not return a valid response.";

    return res.status(200).json({
      ok: true,
      text,
      image: null,
      audio: null
    });

  } catch (err) {
    console.error("Gemini Backend Error:", err);
    return res.status(200).json({
      ok: false,
      text: "Temporary server issue. Please retry."
    });
  }
        }
