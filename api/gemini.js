// api/gemini.js - SUPER FAST EDITION (Llama 8B + Deepgram)
// Ye code 100% Vercel Free Tier friendly hai (No Timeouts)

export const config = {
  maxDuration: 60, // Pro ke liye, Free wale 10s pe cut honge
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Audio file size limit
    },
  },
};

export default async function handler(req, res) {
  // 1. CORS Headers (Browser se connection ke liye zaroori)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Pre-flight request handle karo
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Sirf POST request allow karo
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;

    // API KEYS (Vercel Environment Variables se lo)
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    // Agar keys nahi mili to error dedo
    if (!DEEPGRAM_KEY || !SAMBANOVA_KEY) {
        return res.status(500).json({ error: "Server Keys Missing. Check Vercel Settings." });
    }

    // =================================================================
    // 🎤 MODE 1: VOICE (Uses Llama 8B - The Fastest Model)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // STEP 1: LISTEN (Deepgram Nova-2) - Agar Audio Aaya Hai
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const base64Audio = audioPart.inlineData.data;
            const audioBuffer = Buffer.from(base64Audio, 'base64');
            
            // Deepgram se Audio -> Text convert karo
            const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                method: "POST",
                headers: { 
                    "Authorization": `Token ${DEEPGRAM_KEY}`, 
                    "Content-Type": "audio/wav" 
                },
                body: audioBuffer
            });

            if (!sttResponse.ok) throw new Error("Mic Error (Deepgram STT Failed)");
            const sttData = await sttResponse.json();
            userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            
            // Agar kuch sunayi nahi diya
            if (!userText) return res.status(200).json({ text: "...", audio: null });
        } else if (isTTSRequest) {
            // Agar seedha text bolne ke liye aaya hai
            userText = contents[0].parts[0].text;
        }

        // STEP 2: THINK (Llama 8B - LIGHTNING FAST) ⚡
        // Hum Voice Mode me chhota model use karenge taaki speed mile
        let replyText = userText;
        if (!isTTSRequest) {
            try {
                let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it extremely short (1 sentence).";
                if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

                // 🔥 Using 8B Model (Smallest & Fastest on SambaNova)
                const llmResponse = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { 
                        "Authorization": `Bearer ${SAMBANOVA_KEY}`, 
                        "Content-Type": "application/json" 
                    },
                    body: JSON.stringify({
                        model: "Meta-Llama-3.1-8B-Instruct", // 🚀 SUPER FAST MODEL
                        messages: [
                            { role: "system", content: sysPrompt },
                            { role: "user", content: userText }
                        ],
                        temperature: 0.6,
                        max_tokens: 150 // Voice ke liye chhota answer
                    })
                });
                
                const llmData = await llmResponse.json();
                replyText = llmData.choices?.[0]?.message?.content || "Hmm, main samajh nahi paaya.";
            } catch (e) {
                console.error("LLM Error:", e);
                replyText = "Maafi, server busy hai.";
            }
        }

        // STEP 3: SPEAK (Deepgram Aura TTS)
        // Clean text (Markdown hatao taaki AI symbols na bole)
        const cleanText = replyText.replace(/[*#]/g, '').replace(/\[.*?\]/g, '');

        try {
            const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
                method: "POST",
                headers: { 
                    "Authorization": `Token ${DEEPGRAM_KEY}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({ text: cleanText })
            });

            if (!ttsResponse.ok) throw new Error("Speaker Error (Deepgram TTS Failed)");
            
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

            // Success! Audio aur Text dono bhejo
            return res.status(200).json({ audio: audioBase64, text: replyText });

        } catch (e) {
            console.error("TTS Error:", e);
            // Agar Audio fail ho jaye, to kam se kam Text bhejo
            return res.status(200).json({ text: replyText, error: "Audio generation failed" }); 
        }
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (Cascade Logic: 70B -> 8B)
    // =================================================================
    if (mode === 'text') {
      let systemP = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) systemP = systemInstruction.parts[0].text;
      
      let userM = contents[0].parts.map(p => p.text).join('\n');

      // Helper function to call AI safely
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
              const data = await res.json();
              return data.choices?.[0]?.message?.content;
          } catch (e) { 
              clearTimeout(id); 
              throw e; 
          }
      };

      try {
          // Attempt 1: 70B (Smart Model) - 6 Seconds ka time do
          const text = await callModel("Meta-Llama-3.3-70B-Instruct", 6000);
          return res.status(200).json({ text: text });
      } catch (e) {
          console.warn("70B Failed/Slow, trying 8B...", e.name);
          try {
              // Attempt 2: 8B (Fast Backup) - Turant jawab dega
              const text = await callModel("Meta-Llama-3.1-8B-Instruct", 4000);
              return res.status(200).json({ text: text });
          } catch (e2) {
              return res.status(500).json({ error: "Server abhi bohot busy hai. Kripya thodi der baad try karein." });
          }
      }
    }

    // =================================================================
    // 🎨 MODE 3: IMAGE GENERATION
    // =================================================================
    if (mode === 'image') {
       const promptText = req.body.prompt || "education";
       const encodedPrompt = encodeURIComponent(promptText);
       // Pollinations AI (Free & Fast)
       const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&width=1024&height=1024&model=flux`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Critical Server Error:", error);
    // Sabse zaroori: Crash hone par bhi JSON return karo, Text nahi!
    return res.status(500).json({ error: "Server Timeout or Internal Error" });
  }
    }
