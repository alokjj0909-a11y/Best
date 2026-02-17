// api/gemini.js - FIXED & FAST (100% Working)

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    if (!DEEPGRAM_KEY || !SAMBANOVA_KEY) return res.status(500).json({ error: "API Keys Missing" });

    // =================================================================
    // 🎤 MODE 1: VOICE (Super Fast Llama 8B)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // 1. LISTEN
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "audio/wav" },
                body: audioBuffer
            });
            if (!sttResponse.ok) throw new Error("Mic Error");
            const sttData = await sttResponse.json();
            userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            if (!userText) return res.status(200).json({ text: "...", audio: null });
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // 2. THINK (Llama 8B)
        let replyText = userText;
        if (!isTTSRequest) {
            try {
                let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
                if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

                const llmResponse = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "Meta-Llama-3.1-8B-Instruct", 
                        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userText }],
                        temperature: 0.6,
                        max_tokens: 150
                    })
                });
                const llmData = await llmResponse.json();
                replyText = llmData.choices?.[0]?.message?.content || "Server busy, try again.";
            } catch (e) {
                replyText = "Thinking error.";
            }
        }

        // 3. SPEAK
        try {
            const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
            });
            if (!ttsResponse.ok) throw new Error("TTS Error");
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
            return res.status(200).json({ audio: audioBase64, text: replyText });
        } catch (e) {
            return res.status(200).json({ text: replyText });
        }
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (Fixed Cascade Logic)
    // =================================================================
    if (mode === 'text') {
      let systemP = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) systemP = systemInstruction.parts[0].text;
      let userM = contents[0].parts.map(p => p.text).join('\n');

      // 🔥 FIX: Error Checking Added Here
      const callModel = async (model, timeout) => {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), timeout);
          try {
              const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                      model: model,
                      messages: [{ role: "system", content: systemP }, { role: "user", content: userM }],
                      temperature: 0.7,
                      max_tokens: 1000
                  }),
                  signal: controller.signal
              });
              clearTimeout(id);
              if (!res.ok) throw new Error(`API Error ${res.status}`); // <--- YEH LINE MISSING THI
              const data = await res.json();
              if (!data.choices || !data.choices[0]) throw new Error("Empty Response"); // <--- YEH BHI
              return data.choices[0].message.content;
          } catch (e) { 
              clearTimeout(id); 
              throw e; 
          }
      };

      try {
          // Attempt 1: 70B (Smart)
          const text = await callModel("Meta-Llama-3.3-70B-Instruct", 6000);
          return res.status(200).json({ text: text });
      } catch (e) {
          console.warn("70B failed, switching to 8B...");
          try {
              // Attempt 2: 8B (Fast Backup)
              const text = await callModel("Meta-Llama-3.1-8B-Instruct", 4000);
              return res.status(200).json({ text: text });
          } catch (e2) {
              return res.status(200).json({ text: "Server abhi busy hai. Thodi der baad try karein." });
          }
      }
    }

    // Image Mode
    if (mode === 'image') {
       const promptText = req.body.prompt || "education";
       const encodedPrompt = encodeURIComponent(promptText);
       const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&width=1024&height=1024&model=flux`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Critical:", error);
    // Return valid JSON error to prevent "Unexpected token"
    return res.status(500).json({ error: "Server Error", text: "Something went wrong." });
  }
                                                        }
