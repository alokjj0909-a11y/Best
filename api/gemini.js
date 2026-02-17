// api/gemini.js - ROCKET SPEED EDITION (Llama 8B + Deepgram)
// Ye code 0.5 second me jawab dega, isliye robotic voice nahi aayegi.

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    // Check Keys
    if (!DEEPGRAM_KEY || !SAMBANOVA_KEY) return res.status(500).json({ error: "API Keys Missing in Vercel" });

    // =================================================================
    // 🎤 VOICE MODE (Uses Llama 8B - The Fastest Model)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // 1. SUNNA (Deepgram) - Ye kaam kar raha hai (Proven)
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

        // 2. SOCHNA (Llama 8B - YAHAN CHANGE HAI) ⚡
        // Hum 405B/70B hata kar 8B use kar rahe hain jo timeout nahi hoga.
        let replyText = userText;
        if (!isTTSRequest) {
            try {
                let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short (1-2 sentences).";
                if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

                const llmResponse = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "Meta-Llama-3.1-8B-Instruct", // 🚀 SUPER FAST
                        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userText }],
                        temperature: 0.6,
                        max_tokens: 150
                    })
                });
                const llmData = await llmResponse.json();
                replyText = llmData.choices?.[0]?.message?.content || "Server busy.";
            } catch (e) {
                replyText = "Thinking error.";
            }
        }

        // 3. BOLNA (Deepgram Aura)
        // Agar ye fail hua to hi robotic aawaz aayegi
        try {
            const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
            });

            if (!ttsResponse.ok) throw new Error("TTS Failed");
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

            // Success!
            return res.status(200).json({ audio: audioBase64, text: replyText });
        } catch (e) {
            // Agar audio fail ho, to text bhejo (Robotic Fallback)
            return res.status(200).json({ text: replyText });
        }
    }

    // =================================================================
    // 🧠 TEXT MODE (Standard)
    // =================================================================
    if (mode === 'text') {
      let userM = contents[0].parts.map(p => p.text).join('\n');
      
      // Text mode me bhi hum fast model try karenge
      try {
          const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                  model: "Meta-Llama-3.1-8B-Instruct",
                  messages: [{ role: "system", content: "Helpful Tutor." }, { role: "user", content: userM }],
                  temperature: 0.7,
                  max_tokens: 800
              })
          });
          const data = await res.json();
          return res.status(200).json({ text: data.choices?.[0]?.message?.content });
      } catch (e) {
          return res.status(500).json({ error: "Server Busy" });
      }
    }

    if (mode === 'image') {
       const encodedPrompt = encodeURIComponent(req.body.prompt || "education");
       return res.status(200).json({ image: `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&model=flux` });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", text: "Error occurred." });
  }
          }
