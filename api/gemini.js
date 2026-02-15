// /api/gemini.js  (Vercel)

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
    // 2. API KEY
    // ===============================
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        text: "Backend configuration error. API key missing."
      });
    }

    // ===============================
    // 3. REQUEST BODY
    // ===============================
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = "text", contents, systemInstruction, prompt } = body;

    // ===============================
    // 4. IMAGE MODE (FREE)
    // ===============================
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
    let hasImage = false;
    let imageData = null;

    if (Array.isArray(contents)) {
      contents.forEach(c =>
        c.parts?.forEach(p => {
          if (p.text) userText += p.text + "\n";
          if (p.inlineData) {
            hasImage = true;
            imageData = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
          }
        })
      );
    }

    const messages = [];

    messages.push({
      role: "system",
      content:
        systemInstruction?.parts?.[0]?.text ||
        "You are PadhaiSetu, a helpful Indian education AI. Explain clearly, step-by-step, in simple language."
    });

    if (!hasImage) {
      messages.push({
        role: "user",
        content: userText || "Hello"
      });
    } else {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: userText || "Solve this question" },
          { type: "image_url", image_url: { url: imageData } }
        ]
      });
    }

    // ===============================
    // 7. MODEL SELECTION (FREE ONLY)
    // ===============================
    const MODEL = hasImage
      ? "qwen/qwen2.5-vl-7b-instruct:free"
      : "deepseek/deepseek-r1:free";

    const orResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://padhaisetu.app",
          "X-Title": "PadhaiSetu"
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.7
        })
      }
    );

    const data = await orResponse.json();

    if (data?.choices?.[0]?.message?.content) {
      return res.status(200).json({
        ok: true,
        text: data.choices[0].message.content.trim(),
        image: null,
        audio: null
      });
    }

    return res.status(200).json({
      ok: false,
      text: "AI did not return a valid response. Please retry."
    });

  } catch (err) {
    console.error("Backend Error:", err);
    return res.status(500).json({
      ok: false,
      text: "Temporary server issue. Please retry."
    });
  }
}
