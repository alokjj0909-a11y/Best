// gemini.js — FINAL PRODUCTION VERSION
// Stack: SambaNova (LLM) + Deepgram (STT/TTS)
// Vercel-safe, fast (<3s), no timeout models

const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

/* ---------------------------
   MAIN TEXT / CHAT FUNCTION
---------------------------- */
export async function callBackendAI({ mode = "text", contents }) {
  if (!SAMBANOVA_API_KEY) {
    return "Server config error: AI key missing";
  }

  // ✅ Normalize user text
  let userText = "";
  if (typeof contents === "string") {
    userText = contents.trim();
  } else if (Array.isArray(contents)) {
    userText = contents
      .map(c => c?.parts?.[0]?.text || "")
      .join("\n")
      .trim();
  }

  if (!userText) {
    return "Kuch likho pehle 🙂";
  }

  // ✅ Strong system prompt (Gujarati/Hindi aware)
  const messages = [
    {
      role: "system",
      content: `
You are Badi Didi, a caring Indian tutor.
Rules:
- If user writes in Gujarati, reply ONLY in Gujarati.
- If user writes in Hindi/Hinglish, reply in simple Hinglish/Hindi.
- Keep answers short, clear, student-friendly.
- Do NOT give overly long answers.
      `.trim()
    },
    {
      role: "user",
      content: userText
    }
  ];

  // ✅ FAST & SAFE MODEL (NO TIMEOUT)
  const payload = {
    model: "Meta-Llama-3-8B-Instruct", // 🔥 FAST & STABLE
    messages,
    temperature: 0.4,
    max_tokens: 300,
    top_p: 0.9
  };

  try {
    const res = await fetch(
      "https://api.sambanova.ai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SAMBANOVA_API_KEY}`
        },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const t = await res.text();
      console.error("SambaNova error:", t);
      return "AI thodi busy hai, thodi der baad try karo 🙏";
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "AI reply empty aaya 😅";
  } catch (err) {
    console.error("SambaNova fetch error:", err);
    return "Network issue hai, thodi der baad try karo 🙏";
  }
}

/* ---------------------------
   VOICE → TEXT (Deepgram STT)
---------------------------- */
export async function speechToText(audioBuffer) {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("Missing Deepgram API key");
  }

  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&language=multi",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/webm"
      },
      body: audioBuffer
    }
  );

  const data = await res.json();
  return (
    data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
  );
}

/* ---------------------------
   TEXT → VOICE (Deepgram TTS)
---------------------------- */
export async function textToSpeech(text) {
  if (!DEEPGRAM_API_KEY) {
    throw new Error("Missing Deepgram API key");
  }

  const res = await fetch(
    "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    }
  );

  return await res.arrayBuffer(); // audio buffer
}
