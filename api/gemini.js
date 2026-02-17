// api/gemini.js - SPEED EDITION (Deepgram + Llama 70B)

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
    const { mode, contents } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    // Keys Check
    if (!DEEPGRAM_KEY || !SAMBANOVA_KEY) return res.status(500).json({ error: "Server Keys Missing" });

    // =================================================================
    // 🎤 VOICE MODE (Uses Llama 70B for SPEED)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // 1. LISTEN (Deepgram)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            
            const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "audio/wav" },
                body: audioBuffer
            });

            if (!sttResponse.ok) throw new Error("Listening Failed");
            const sttData = await sttResponse.json();
            userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            
            if (!userText) return res.status(200).json({ text: "...", audio: null });
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // 2. THINK (Llama 70B - SUPER FAST)
        let replyText = userText;
        if (!isTTSRequest) {
            // 🔥 USING 70B INSTEAD OF 405B (Ye 10x Fast hai)
            const llmResponse = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "Meta-Llama-3.3-70B-Instruct", // Fast Model
                    messages: [
                        { role: "system", content: "You are PadhaiSetu. Reply in Hinglish. Keep it extremely short (1-2 sentences)." },
                        { role: "user", content: userText }
                    ],
                    temperature: 0.7,
                    max_tokens: 150
                })
            });
            const llmData = await llmResponse.json();
            replyText = llmData.choices?.[0]?.message?.content || "Hmm...";
        }

        // 3. SPEAK (Deepgram Aura)
        const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
            method: "POST",
            headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
        });

        if (!ttsResponse.ok) throw new Error("Speaking Failed");
        const arrayBuffer = await ttsResponse.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return res.status(200).json({ audio: audioBase64, text: replyText });
    }

    // =================================================================
    // 🧠 TEXT MODE (Still uses 405B for Chat)
    // =================================================================
    if (mode === 'text') {
      let userMessage = contents[0].parts.map(p => p.text).join('\n');
      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-405B-Instruct",
          messages: [{ role: "system", content: "Helpful Tutor." }, { role: "user", content: userMessage }],
          temperature: 0.7,
          max_tokens: 800
        })
      });
      const data = await response.json();
      return res.status(200).json({ text: data.choices?.[0]?.message?.content });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error" });
  }
                     }
