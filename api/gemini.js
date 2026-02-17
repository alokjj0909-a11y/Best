// api/gemini.js — FINAL (SambaNova + Deepgram only)
// Voice: Deepgram STT + TTS
// Text: SambaNova Cascade (405B → 70B → 8B)
// Designed for Vercel (safe from 10s timeout)

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "6mb", // audio ke liye
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

    if (!SAMBA_KEY)
      return res.status(500).json({ error: "SAMBANOVA_KEY missing" });
    if (!DEEPGRAM_KEY)
      return res.status(500).json({ error: "DEEPGRAM_API_KEY missing" });

    // =====================================================
    // 🎤 VOICE MODE (Deepgram STT → SambaNova → Deepgram TTS)
    // =====================================================
    const hasAudio =
      contents?.[0]?.parts?.some(
        (p) => p.inlineData && p.inlineData.mimeType.startsWith("audio")
      );

    if (mode === "tts" || (mode === "text" && hasAudio)) {
      // -------- 1. AUDIO EXTRACT --------
      const audioPart = contents[0].parts.find((p) => p.inlineData);
      if (!audioPart)
        return res.status(400).json({ error: "Audio missing" });

      const audioBuffer = Buffer.from(
        audioPart.inlineData.data,
        "base64"
      );

      // -------- 2. DEEPGRAM STT (CORRECT FORMAT) --------
      const sttRes = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&language=hi",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${DEEPGRAM_KEY}`,
            "Content-Type": audioPart.inlineData.mimeType || "audio/webm",
          },
          body: audioBuffer, // ⚠️ RAW AUDIO ONLY
        }
      );

      if (!sttRes.ok) {
        const t = await sttRes.text();
        throw new Error("Deepgram STT failed: " + t);
      }

      const sttData = await sttRes.json();
      const userText =
        sttData?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

      if (!userText)
        throw new Error("Deepgram STT empty transcript");

      // -------- 3. SYSTEM PROMPT --------
      let sysPrompt = "You are Badi Didi, a caring Indian tutor.";
      if (systemInstruction?.parts?.[0]?.text) {
        sysPrompt = systemInstruction.parts[0].text;
      }

      const messages = [
        { role: "system", content: sysPrompt },
        { role: "user", content: userText },
      ];

      // -------- 4. SAMBANOVA CASCADE --------
      const callSamba = async (model, timeoutMs) => {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), timeoutMs);

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

          clearTimeout(tId);
          if (!r.ok) throw new Error("Model failed");

          const d = await r.json();
          return d.choices?.[0]?.message?.content || null;
        } catch (e) {
          clearTimeout(tId);
          throw e;
        }
      };

      let replyText = null;

      try {
        replyText = await callSamba(
          "Meta-Llama-3.1-405B-Instruct",
          6000
        );
      } catch {
        try {
          replyText = await callSamba(
            "Meta-Llama-3.3-70B-Instruct",
            5000
          );
        } catch {
          replyText = await callSamba(
            "Meta-Llama-3.1-8B-Instruct",
            3000
          );
        }
      }

      if (!replyText)
        return res
          .status(500)
          .json({ error: "All models busy" });

      // -------- 5. DEEPGRAM TTS --------
      const cleanText = replyText.replace(/[*#]/g, "");

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

      const audioArr = await ttsRes.arrayBuffer();
      const audioBase64 = Buffer.from(audioArr).toString("base64");

      return res.status(200).json({
        text: replyText,
        audio: audioBase64,
      });
    }

    // ===========================
    // 🧠 TEXT ONLY MODE
    // ===========================
    if (mode === "text") {
      let sysPrompt = "You are a helpful tutor.";
      if (systemInstruction?.parts?.[0]?.text)
        sysPrompt = systemInstruction.parts[0].text;

      const userText = contents[0].parts.map((p) => p.text).join("\n");

      const r = await fetch(
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
            max_tokens: 800,
          }),
        }
      );

      const d = await r.json();
      return res.status(200).json({
        text: d.choices?.[0]?.message?.content,
      });
    }

    return res.status(400).json({ error: "Invalid mode" });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
          }
