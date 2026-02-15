// /api/gemini.js  (Groq Version for PadhaiSetu)

export default async function handler(req, res) {
  // ===============================
  // 1. CORS
  // ===============================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, text: "Method Not Allowed" });
  }

  try {
    // ===============================
    // 2. GROQ API KEY
    // ===============================
    const API_KEY = process.env.GROQ_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        text: "Backend config error: Missing GROQ_API_KEY"
      });
    }

    // ===============================
    // 3. Parse Body
    // ===============================
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = "text", contents, systemInstruction } = body;

    // ===============================
    // 4. IMAGE MODE (still free via Pollinations)
    // ===============================
    if (mode === "image") {
      const prompt =
        contents?.[0]?.parts?.[0]?.text || "Educational diagram";

      return res.status(200).json({
        ok: true,
        text: "Image generated",
        image: `https://image.pollinations.ai/prompt/${encodeURIComponent(
          prompt
        )}?width=1024&height=768&nologo=true`,
        audio: null
      });
    }

    // ===============================
    // 5. TTS MODE (Browser fallback)
    // ===============================
    if (mode === "tts") {
      return res.status(200).json({
        ok: true,
        text: "Using browser TTS",
        image: null,
        audio: null
      });
    }

    // ===============================
    // 6. TEXT / CHAT MODE
    // ===============================
    let userText = "";
    if (Array.isArray(contents)) {
      contents.forEach(c =>
        c.parts?.forEach(p => {
          if (p.text) userText += p.text + "\n";
        })
      );
    }

    const messages = [
      {
        role: "system",
        content:
          systemInstruction?.parts?.[0]?.text ||
          "You are PadhaiSetu, a helpful Indian education AI. Explain clearly, step-by-step, in simple language."
      },
      {
        role: "user",
        content: userText || "Hello"
      }
    ];

    // ===============================
    // 7. SMART MODEL SELECTION
    // ===============================
    // Default → fast chat
    let MODEL = "llama-3.1-8b-instant";

    // If long explanation / smart class
    if (userText.length > 400) {
      MODEL = "mixtral-8x7b-32768";
    }

    // ===============================
    // 8. Call GROQ
    // ===============================
    const groqRes = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7
        })
      }
    );

    const data = await groqRes.json();

    return res.status(200).json({
      ok: true,
      text:
        data?.choices?.[0]?.message?.content ||
        "⚠️ AI did not return a valid response.",
      image: null,
      audio: null
    });

  } catch (err) {
    console.error("Groq Backend Error:", err);
    return res.status(200).json({
      ok: false,
      text: "AI is busy right now. Please retry in a moment."
    });
  }
}
