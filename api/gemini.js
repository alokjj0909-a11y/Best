// /api/gemini.js  (Chutes AI)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, text: "Method Not Allowed" });
  }

  try {
    const API_KEY = process.env.CHUTES_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        text: "Backend config error: Missing Chutes API Key"
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = "text", contents, systemInstruction, prompt } = body;

    /* IMAGE MODE (optional fallback) */
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

    /* TTS MODE (browser fallback) */
    if (mode === "tts") {
      return res.status(200).json({
        ok: true,
        text: "Using browser TTS",
        image: null,
        audio: null
      });
    }

    /* TEXT MODE */
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
          "You are PadhaiSetu, a friendly Indian education AI who explains clearly in simple language."
      },
      { role: "user", content: userText || "Hello" }
    ];

    const response = await fetch("https://api.chutes.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3-0324-TEE",
        messages,
        temperature: 0.7
      })
    });

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      text:
        data?.choices?.[0]?.message?.content ||
        "⚠️ AI did not return a valid response.",
      image: null,
      audio: null
    });

  } catch (err) {
    console.error("Chutes Backend Error:", err);
    return res.status(200).json({
      ok: false,
      text: "Temporary server issue. Please retry."
    });
  }
  }
