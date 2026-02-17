// api/gemini.js - FINAL VOICE STACK (Deepgram + SambaNova Anti-Crash)

export const config = {
  maxDuration: 60, // Pro plan ke liye 60s, Free ke liye 10s
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Audio upload size limit
    },
  },
};

export default async function handler(req, res) {
  // 1. CORS Headers (Browser connection ke liye zaroori)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;

    // KEYS CHECK
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    if (!DEEPGRAM_KEY || !SAMBANOVA_KEY) {
        return res.status(500).json({ error: "Server Keys Missing (Check Vercel Settings)" });
    }

    // =================================================================
    // 🔥 SMART SWITCHER (Vercel Timeout se bachne ka tareeka)
    // =================================================================
    const callSambaNovaSafe = async (messages, maxTokens = 800) => {
        
        // Helper: Fetch with Timeout
        const fetchWithTimeout = async (modelId, timeoutMs) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                console.log(`Trying ${modelId} with ${timeoutMs}ms limit...`);
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
                clearTimeout(id);
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                const data = await response.json();
                return data.choices?.[0]?.message?.content;
            } catch (error) {
                clearTimeout(id);
                throw error;
            }
        };

        // 🚀 STRATEGY:
        // 1. Pehle 405B (Sabse Smart) try karo (6 second tak).
        // 2. Agar wo slow hai, to turant 70B (Fast) par switch karo.
        try {
            return await fetchWithTimeout("Meta-Llama-3.1-405B-Instruct", 6000);
        } catch (e) {
            console.warn("405B slow/failed, switching to 70B...", e.name);
            try {
                // Backup: 70B is super fast
                return await fetchWithTimeout("Meta-Llama-3.3-70B-Instruct", 8000); 
            } catch (e2) {
                return "Maafi chahunga, server par load zyada hai. Dobara koshish karein.";
            }
        }
    };

    // =================================================================
    // 🎤 MODE 1: VOICE (Deepgram Listen -> SambaNova Think -> Deepgram Speak)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        
        let userText = "";

        // STEP 1: SUNNA (Deepgram Nova-2 STT)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const base64Audio = audioPart.inlineData.data;
            const audioBuffer = Buffer.from(base64Audio, 'base64');

            const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                method: "POST",
                headers: { 
                    "Authorization": `Token ${DEEPGRAM_KEY}`, 
                    "Content-Type": "audio/wav" 
                },
                body: audioBuffer
            });

            if (!sttResponse.ok) throw new Error("Deepgram Ear Failed");
            const sttData = await sttResponse.json();
            userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            
            if (!userText) return res.status(200).json({ text: "...", audio: null }); // Kuch sunayi nahi diya
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // STEP 2: SOCHNA (SambaNova Llama)
        let replyText = userText;
        if (!isTTSRequest) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish (Hindi+English). Keep it short and natural.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            // Voice ke liye chhota answer (300 tokens)
            replyText = await callSambaNovaSafe([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ], 300);
        }

        // STEP 3: BOLNA (Deepgram Aura TTS)
        const cleanText = replyText.replace(/[*#]/g, '').replace(/\[.*?\]/g, ''); 
        const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
            method: "POST",
            headers: { 
                "Authorization": `Token ${DEEPGRAM_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ text: cleanText })
        });

        if (!ttsResponse.ok) throw new Error("Deepgram Mouth Failed");

        const arrayBuffer = await ttsResponse.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return res.status(200).json({ audio: audioBase64, text: replyText });
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (SambaNova Safe Mode)
    // =================================================================
    if (mode === 'text') {
      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) finalSystemPrompt = systemInstruction.parts[0].text;
      
      let userMessage = contents[0].parts.map(p => p.text).join('\n');

      // Chat ke liye bada answer allow hai (1500 tokens)
      const responseText = await callSambaNovaSafe([
          { role: "system", content: finalSystemPrompt },
          { role: "user", content: userMessage }
      ], 1500);

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
    // Crash hone par bhi JSON bhejo taaki frontend na phate
    return res.status(500).json({ error: "Server busy or configuration error." });
  }
              }
