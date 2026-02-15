// /api/gemini.js  (Vercel - Azure OpenAI GPT-4.1)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, text: "Method Not Allowed" });
  }

  try {
    const API_KEY = process.env.AZURE_OPENAI_API_KEY;
    const ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;

    if (!API_KEY || !ENDPOINT) {
      return res.status(500).json({
        ok: false,
        text: "Backend config error: Missing Azure OpenAI credentials"
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { mode = "text", contents, systemInstruction, prompt } = body;

    /* ================= IMAGE MODE (FREE FALLBACK) ================= */
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
          "You are PadhaiSetu, a helpful Indian education AI. Respond clearly, politely, and in simple language."
      },
      {
        role: "user",
        content: userText || "Hello"
      }
    ];

    const response = await fetch(
      `${ENDPOINT}/openai/deployments/gpt-4.1/chat/completions?api-version=2024-02-15-preview`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": API_KEY
        },
        body: JSON.stringify({
          messages,
          temperature: 0.6,
          max_tokens: 800
        })
      }
    );

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
    console.error("Azure OpenAI Error:", err);
    return res.status(200).json({
      ok: false,
      text: "AI busy hai. Thodi der baad try karo."
    });
  }
}
