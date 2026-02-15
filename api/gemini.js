// /api/gemini.js  (Vercel)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, text: "Method Not Allowed" });
  }

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        text: "GEMINI_API_KEY missing"
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = "text", contents, systemInstruction, prompt } = body || {};

    /* ---------- IMAGE MODE (fallback) ---------- */
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

    /* ---------- TTS MODE ---------- */
    if (mode === "tts") {
      return res.status(200).json({
        ok: true,
        text: "Using browser TTS",
        image: null,
        audio: null
      });
    }

    /* ---------- TEXT / CHAT MODE ---------- */

    // ✅ SAFE CONTENTS
    const safeContents =
      Array.isArray(contents) && contents.length
        ? contents
        : [
            {
              role: "user",
              parts: [{ text: "Hello" }]
            }
          ];

    const payload = {
      contents: safeContents,
      generationConfig: {
        temperature: 0.7
      }
    };

    // ✅ PROPER systemInstruction
    if (systemInstruction?.parts?.[0]?.text) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction.parts[0].text }]
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    return res.status(200).json({
      ok: true,
      text: text || "⚠️ AI busy hai. Thodi der baad try karo.",
      image: null,
      audio: null
    });

  } catch (err) {
    console.error("Gemini Error:", err);
    return res.status(200).json({
      ok: false,
      text: "Temporary server issue. Please retry."
    });
  }
}
