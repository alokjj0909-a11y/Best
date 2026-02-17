// api/gemini.js
// FINAL PRODUCTION STACK
// Deepgram (STT + TTS) + SambaNova (405B → 70B → 8B)
// Vercel-safe, fast, stable

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "6mb", // audio upload
    },
  },
};

export default async function handler(req, res) {
  // ---------------- CORS ----------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { mode, contents, systemInstruction } = req.body;

    const SAMBA_KEY = process.env.SAMBANOVA_KEY;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    if (!SAMBA_KEY) throw new Error("SAMBANOVA_KEY missing");
    if (!DEEPGRAM_KEY) throw new Error("DEEPGRAM_API_KEY missing");

    // =====================================================
    // 🎤 VOICE MODE (STT → LLM → TTS)
    // =====================================================
    const hasAudio =
      contents?.[0]?.parts?.some(
        (p) => p.inlineData && p.inlineData.mimeType.startsWith("audio")
      );

    if (mode === "tts" || (mode === "text" && hasAudio)) {
      let userText = "";

      // ---------- STT (Deepgram - CORRECT FORMAT) ----------
      if (hasAudio) {
        const audioPart = contents[0].parts.find((p) => p.inlineData);
        const audioBuffer = Buffer.from(
          audioPart.inlineData.data,
          "base64"
        );

        const sttRes = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-2&language=hi",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${DEEPGRAM_KEY}`,
              "Content-Type": audioPart.inlineData.mimeType || "audio/webm",
            },
            body: audioBuffer, // 🔥 RAW AUDIO ONLY
          }
        );

        if (!sttRes.ok) {
          const e = await sttRes.text();
          throw new Error("Deepgram STT failed: " + e);
        }

        const sttData = await sttRes.json();
        userText =
          sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;

        if (!userText) throw new Error("Empty transcript from Deepgram");
      } else {
        userText = contents[0].parts[0].text;
      }

      // ---------- SYSTEM PROMPT ----------
      let sysPrompt =
        "You are PadhaiSetu, a caring Indian tutor. Reply in Hinglish. Be warm, supportive, and concise.";
      if (systemInstruction?.parts?.[0]?.text)
        sysPrompt = systemInstruction.parts[0].text;

      const messages = [
        { role: "system", content: sysPrompt },
        { role: "user", content: userText },
      ];

      // ---------- SambaNova Cascade Helper ----------
      const callSamba = async (model, timeoutMs) => {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const r = await fetch(
            "https://api.sambanova.ai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SAMBA_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 800,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(t);
          if (!r.ok) throw new Error("Samba error " + r.status);
          const d = await r.json();
          return d.choices?.[0]?.message?.content || null;
        } catch (e) {
          clearTimeout(t);
          throw e;
        }
      };

      // ---------- LLM CASCADE ----------
      let answer = null;
      try {
        answer = await callSamba("Meta-Llama-3.1-405B-Instruct", 6000);
      } catch {}
      if (!answer) {
        try {
          answer = await callSamba("Meta-Llama-3.3-70B-Instruct", 5000);
        } catch {}
      }
      if (!answer) {
        answer = await callSamba("Meta-Llama-3.1-8B-Instruct", 4000);
      }

      // ---------- TTS (Deepgram) ----------
      const cleanText = answer.replace(/[*#_`]/g, "");

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

      if (!ttsRes.ok)
        throw new Error("Deepgram TTS failed");

      const audioBuf = await ttsRes.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuf).toString("base64");

      return res.status(200).json({
        text: answer,
        audio: audioBase64,
      });
    }

    // =====================================================
    // 🧠 TEXT ONLY MODE (SambaNova)
    // =====================================================
    if (mode === "text") {
      let sysPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text)
        sysPrompt = systemInstruction.parts[0].text;

      const userText = contents[0].parts.map((p) => p.text).join("\n");

      const response = await fetch(
        "https://api.sambanova.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SAMBA_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "Meta-Llama-3.3-70B-Instruct",
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          }),
        }
      );

      const data = await response.json();
      return res
        .status(200)
        .json({ text: data.choices?.[0]?.message?.content });
    }

    return res.status(400).json({ error: "Invalid mode" });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
      }
