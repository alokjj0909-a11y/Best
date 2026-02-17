// gemini.js — FINAL (SambaNova + Deepgram ONLY)

const SAMBANOVA_API_KEY = process.env.SAMBANOVA_API_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// 🔥 MAIN BACKEND FUNCTION
export async function callBackendAI(payload) {
  const { mode } = payload;

  // =========================
  // 1️⃣ TEXT MODE (SambaNova)
  // =========================
  if (mode === "text") {
    if (!SAMBANOVA_API_KEY) {
      return { ok: false, text: "Server error: SambaNova API key missing" };
    }

    // HTML se aane wala content clean karo
    let userText = "";
    try {
      if (Array.isArray(payload.contents)) {
        userText = payload.contents
          .map(c => c?.parts?.[0]?.text || "")
          .join("\n")
          .trim();
      } else if (typeof payload.contents === "string") {
        userText = payload.contents;
      }
    } catch {}

    if (!userText) {
      return { ok: false, text: "Kuch likho pehle 🙂" };
    }

    const systemPrompt =
      payload.systemInstruction?.parts?.[0]?.text ||
      "You are a caring Indian tutor. Answer clearly and simply.";

    const body = {
      model: "Meta-Llama-3.1-8B-Instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText }
      ],
      temperature: payload.generationConfig?.temperature ?? 0.6,
      max_tokens: 600
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
          body: JSON.stringify(body)
        }
      );

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content;

      return reply
        ? { ok: true, text: reply }
        : { ok: false, text: "AI reply empty aaya 😅" };
    } catch (e) {
      console.error("SambaNova error:", e);
      return { ok: false, text: "AI thodi busy hai, try again 🙏" };
    }
  }

  // =========================
  // 2️⃣ TTS MODE (Deepgram)
  // =========================
  if (mode === "tts") {
    if (!DEEPGRAM_API_KEY) {
      return { ok: false, text: "Deepgram key missing" };
    }

    const text =
      payload.contents?.[0]?.parts?.[0]?.text?.slice(0, 3000) || "";

    try {
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

      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      return { ok: true, audio: base64 };
    } catch (e) {
      console.error("Deepgram TTS error:", e);
      return { ok: false, text: "Voice generate nahi ho payi" };
    }
  }

  return { ok: false, text: "Invalid mode" };
}

// 🔧 Helper
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result.split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
      }
