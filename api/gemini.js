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
    const API_KEY = process.env.OPENROUTER_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        text: "Backend config error: API key missing"
      });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { mode = "text", contents, systemInstruction, prompt } = body;

    /* ================= IMAGE MODE ================= */
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

    /* ================= TTS MODE ================= */
    if (mode === "tts") {
      // Frontend already uses browser speechSynthesis
      return res.status(200).json({
        ok: true,
        text: "Using browser TTS",
        image: null,
        audio: null
      });
    }

    /* ================= TEXT / CHAT MODE ================= */
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
          "You are PadhaiSetu, a helpful Indian education AI."
      },
      {
        role: "user",
        content: userText || "Hello"
      }
    ];

    // ✅ FREE + POWERFUL MODEL
    const MODEL = "deepseek/deepseek-r1:free";

    const orResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
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

    return res.status(200).json({
      ok: true,
      text:
        data?.choices?.[0]?.message?.content ||
        "⚠️ AI did not return a valid response. Please retry.",
      image: null,
      audio: null
    });

  } catch (err) {
    console.error("Backend Error:", err);
    return res.status(200).json({
      ok: false,
      text: "Temporary server issue. Please retry."
    });
  }
}
