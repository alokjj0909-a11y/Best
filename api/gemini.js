// api/gemini.js - ANTI-CRASH BACKEND (Deepgram + SambaNova Smart Switch)

export const config = {
  maxDuration: 60, // Pro plan ke liye, Free plan 10s pe cut karega
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
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

    // KEYS
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    if (!SAMBANOVA_KEY) return res.status(500).json({ error: "Server Config Error: SAMBANOVA_KEY missing." });

    // =================================================================
    // 🔥 HELPER: SAMBANOVA SMART SWITCHER (The Fix for 'Unexpected Token T')
    // =================================================================
    const callSambaNovaWithFallback = async (messages, maxTokens = 1000) => {
        
        // Function to call a specific model with a timeout
        const tryModel = async (modelId, timeoutMs) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                console.log(`Trying Model: ${modelId} (Timeout: ${timeoutMs}ms)`);
                const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": `Bearer ${SAMBANOVA_KEY}`, 
                        "Content-Type": "application/json" 
                    },
                    body: JSON.stringify({
                        model: modelId,
                        messages: messages,
                        temperature: 0.7,
                        max_tokens: maxTokens
                    }),
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                const data = await response.json();
                return data.choices?.[0]?.message?.content;
            } catch (error) {
                clearTimeout(timeoutId);
                throw error; // Let the main function catch this
            }
        };

        // 🚀 STRATEGY:
        // 1. Try 405B (The Beast) for 6 seconds.
        // 2. If it fails or takes too long, Switch to 70B (The Speedster).
        
        try {
            // Attempt 1: 405B (Strict 6s limit to beat Vercel's 10s limit)
            return await tryModel("Meta-Llama-3.1-405B-Instruct", 6000);
        } catch (err) {
            console.warn("405B timed out or failed. Switching to 70B...", err.name);
            try {
                // Attempt 2: 70B (Very Fast, High Intelligence)
                return await tryModel("Meta-Llama-3.3-70B-Instruct", 8000);
            } catch (err2) {
                console.error("All models failed:", err2);
                return "Maafi chahunga, server abhi busy hai. Kripya punah prayas karein.";
            }
        }
    };

    // =================================================================
    // 🎤 MODE 1: VOICE (Deepgram + SambaNova Switcher)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        if (!DEEPGRAM_KEY) return res.status(500).json({ error: "DEEPGRAM_KEY missing." });

        let userText = "";

        // STEP 1: LISTEN (Deepgram Nova-2)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const base64Audio = audioPart.inlineData.data;
            const audioBuffer = Buffer.from(base64Audio, 'base64');

            const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "audio/wav" },
                body: audioBuffer
            });

            if (!sttResponse.ok) throw new Error("Deepgram STT Failed");
            const sttData = await sttResponse.json();
            userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            
            if (!userText) return res.status(200).json({ text: "...", audio: null });
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // STEP 2: THINK (Using Smart Switcher)
        let replyText = userText;
        if (!isTTSRequest) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish (Hindi+English). Keep it short.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            const messages = [
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ];
            
            // 🔥 Use the Safe Switcher here
            replyText = await callSambaNovaWithFallback(messages, 300); 
        }

        // STEP 3: SPEAK (Deepgram Aura)
        const cleanText = replyText.replace(/[*#`]/g, '').replace(/\[.*?\]/g, ''); 
        const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
            method: "POST",
            headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: cleanText })
        });

        if (!ttsResponse.ok) throw new Error("Deepgram TTS Failed");
        const arrayBuffer = await ttsResponse.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return res.status(200).json({ audio: audioBase64, text: replyText });
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (Using Smart Switcher)
    // =================================================================
    if (mode === 'text') {
      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) finalSystemPrompt = systemInstruction.parts[0].text;
      
      let userMessage = contents[0].parts.map(p => p.text).join('\n');
      
      const messages = [
        { role: "system", content: finalSystemPrompt },
        { role: "user", content: userMessage }
      ];

      // 🔥 Use the Safe Switcher here too
      const responseText = await callSambaNovaWithFallback(messages, 1500);
      return res.status(200).json({ text: responseText });
    }

    // =================================================================
    // 🎨 MODE 3: IMAGE GENERATION
    // =================================================================
    if (mode === 'image') {
      const promptText = req.body.prompt || "education";
      const encodedPrompt = encodeURIComponent(promptText);
      const randomSeed = Math.floor(Math.random() * 10000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&seed=${randomSeed}&width=1024&height=1024&model=flux`;
      return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Critical Server Error:", error);
    // Return valid JSON even on error to prevent 'Unexpected token'
    return res.status(500).json({ error: error.message || "Server Error" });
  }
                                             }
