// api/gemini.js — FINAL STABLE (SambaNova + Deepgram)

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "6mb", // audio ke liye
    },
  },
};

export default async function handler(req, res) {
  // CORS
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

    // ======================================================
    // 🎤 VOICE MODE (STT -> SambaNova -> TTS)
    // ======================================================
    const hasAudio =
      contents?.[0]?.parts?.some(
        (p) => p.inlineData && p.inlineData.mimeType.startsWith("audio")
      );

    if (mode === "tts" || (mode === "text" && hasAudio)) {
      // ---------- STT ----------
      let userText = "";

      if (hasAudio) {
        const audioPart = contents[0].parts.find((p) => p.inlineData);
        const audioBuffer = Buffer.from(audioPart.inlineData.data, "base64");

        const sttRes = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
          {
            method: "POST",
            headers: {
              "Authorization": `Token ${DEEPGRAM_KEY}`,
              "Content-Type": audioPart.inlineData.mimeType,
            },
            body: audioBuffer,
          }
        );

        if (!sttRes.ok) {
          const t = await sttRes.text();
          throw new Error("Deepgram STT failed: " + t);
        }

        const sttData = await sttRes.json();
        userText =
          sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

        if (!userText) {
          return res.status(200).json({ text: "Main aapki awaaz samajh nahi paaya 🙏" });
        }
      } else {
        userText = contents[0].parts[0].text;
      }

      // ---------- SYSTEM PROMPT ----------
      let sysPrompt = "You are Badi Didi, a caring Indian tutor. Reply in simple Hinglish/Hindi.";
      if (systemInstruction?.parts?.[0]?.text)
        sysPrompt = systemInstruction.parts[0].text;

      // ---------- SambaNova TEXT ----------
      const chatRes = await fetch(
        "https://api.sambanova.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SAMBA_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "Meta-Llama-3.3-70B-Instruct",
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.7,
            max_tokens: 400,
          }),
        }
      );

      if (!chatRes.ok) {
        throw new Error("SambaNova failed");
      }

      const chatData = await chatRes.json();
      const answer =
        chatData.choices?.[0]?.message?.content ||
        "Main abhi jawab nahi de pa rahi 🙏";

      // ---------- TTS ----------
      const ttsRes = await fetch(
        "https://api.deepgram.com/v1/speak?model=aura-asteria-en",
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${DEEPGRAM_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: answer }),
        }
      );

      if (!ttsRes.ok) {
        const t = await ttsRes.text();
        throw new Error("Deepgram TTS failed: " + t);
      }

      const audioArray = await ttsRes.arrayBuffer();
      const audioBase64 = Buffer.from(audioArray).toString("base64");

      return res.status(200).json({
        text: answer,
        audio: audioBase64,
      });
    }

    // ======================================================
    // 🧠 TEXT MODE ONLY (FAST)
    // ======================================================
    if (mode === "text") {
      let sysPrompt = "You are a helpful Indian tutor.";
      if (systemInstruction?.parts?.[0]?.text)
        sysPrompt = systemInstruction.parts[0].text;

      const userText = contents[0].parts.map((p) => p.text).join("\n");

      const resp = await fetch(
        "https://api.sambanova.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SAMBA_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "Meta-Llama-3.1-8B-Instruct", // FAST & SAFE
            messages: [
              { role: "system", content: sysPrompt },
              { role: "user", content: userText },
            ],
            temperature: 0.7,
            max_tokens: 800,
          }),
        }
      );

      const data = await resp.json();
      return res.status(200).json({
        text: data.choices?.[0]?.message?.content || "",
      });
    }

    return res.status(400).json({ error: "Invalid mode" });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
  }
