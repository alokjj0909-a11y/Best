// api/gemini.js — FINAL TIME-BOMB + FALLBACK VERSION
// Stack: Deepgram (STT + TTS) + SambaNova (LLM)
// Network-safe, Vercel-safe, Production-ready

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: { sizeLimit: "4mb" },
  },
};

const SAMBANOVA_URL = "https://api.sambanova.ai/v1/chat/completions";

// ⏱ timeout helper
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// 🧠 LLM CALL with MODEL FALLBACK
async function callSambaNovaLLM({ apiKey, systemPrompt, userText }) {
  const MODELS = [
    { name: "Meta-Llama-3.1-405B-Instruct", timeout: 6000 }, // Time bomb 💣
    { name: "Meta-Llama-3.3-70B-Instruct", timeout: 5000 },  // Fast & smart
    { name: "Meta-Llama-3-8B-Instruct", timeout: 4000 },     // Emergency
  ];

  for (const model of MODELS) {
    try {
      const res = await fetchWithTimeout(
        SAMBANOVA_URL,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model.name,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.4,
            max_tokens: 300,
          }),
        },
        model.timeout
      );

      if (!res.ok) throw new Error("Model failed");

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (text) return text;

    } catch (err) {
      console.warn(`Model skipped: ${model.name}`);
    }
  }

  return "Thoda network slow hai 😅 phir se try karo.";
}

export default async function handler(req, res) {
  try {
    const { contents, systemInstruction } = req.body;

    const SAMBANOVA_KEY = process.env.SAMBANOVA_API_KEY;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    if (!SAMBANOVA_KEY || !DEEPGRAM_KEY) {
      return res.status(500).json({ error: "API key missing" });
    }

    /* ===============================
       🎤 VOICE → TEXT (Deepgram STT)
    =============================== */
    let userText = "";
    const hasAudio =
      contents?.[0]?.parts?.some(p => p.inlineData?.mimeType?.startsWith("audio"));

    if (hasAudio) {
      const audioPart = contents[0].parts.find(p => p.inlineData);
      const audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");

      const sttRes = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&language=multi",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DEEPGRAM_KEY}`,
            "Content-Type": "audio/webm",
          },
          body: audioBuffer,
        }
      );

      const sttData = await sttRes.json();
      userText =
        sttData?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
    } else {
      userText = contents?.[0]?.parts?.map(p => p.text).join(" ") || "";
    }

    if (!userText.trim()) {
      return res.status(200).json({ text: "Kuch boliye 🙂" });
    }

    /* ===============================
       🧠 THINKING (TIME BOMB LOGIC)
    =============================== */
    let systemPrompt =
      "You are Badi Didi, a caring Indian tutor. Answer simply.";

    if (systemInstruction?.parts?.[0]?.text) {
      systemPrompt = systemInstruction.parts[0].text;
    }

    const answer = await callSambaNovaLLM({
      apiKey: SAMBANOVA_KEY,
      systemPrompt,
      userText,
    });

    /* ===============================
       🔊 TEXT → VOICE (Deepgram TTS)
    =============================== */
    const cleanText = answer.replace(/[*#]/g, "");

    const ttsRes = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: cleanText }),
      }
    );

    const audioBuffer = await ttsRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    return res.status(200).json({
      text: answer,
      audio: audioBase64,
    });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Internet issue." });
  }
           }
