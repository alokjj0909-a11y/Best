// api/gemini.js - POWERFUL VOICE STACK (Deepgram STT + SambaNova LLM + Deepgram TTS)

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Audio upload size badhaya
    },
  },
};

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;

    // API KEYS CHECK
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    if (!DEEPGRAM_KEY || !SAMBANOVA_KEY) {
        return res.status(500).json({ error: "Configuration Error: DEEPGRAM_API_KEY or SAMBANOVA_KEY is missing." });
    }

    // =================================================================
    // 🎤 MODE 1: VOICE CONVERSATION (Deepgram -> SambaNova -> Deepgram)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        
        let userText = "";

        // STEP 1: LISTEN (Deepgram Nova-2 STT) - Agar Audio Aaya Hai
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const base64Audio = audioPart.inlineData.data;
            const audioBuffer = Buffer.from(base64Audio, 'base64');

            // Deepgram Listen API Call
            // Nova-2 Model: Best for accuracy & speed
            const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${DEEPGRAM_KEY}`,
                    "Content-Type": "audio/wav" // Ya jo bhi format aa raha hai
                },
                body: audioBuffer
            });

            if (!sttResponse.ok) throw new Error(`Deepgram Ear Failed: ${await sttResponse.text()}`);
            const sttData = await sttResponse.json();
            
            userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
            
            if (!userText) return res.status(200).json({ text: "...", audio: null }); // Agar kuch sunayi nahi diya
            console.log("User Said (Deepgram):", userText);
        } 
        else if (isTTSRequest) {
            // Agar seedha text aaya hai bolne ke liye
            userText = contents[0].parts[0].text;
        }

        // STEP 2: THINK (SambaNova Llama 405B) - Only if not TTS request
        let replyText = userText;
        if (!isTTSRequest) {
            let sysPrompt = "You are PadhaiSetu, a helpful Indian tutor. Reply in Hinglish (Hindi+English mix). Keep it short, natural and conversational.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            // SambaNova Call
            const llmResponse = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${SAMBANOVA_KEY}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    model: "Meta-Llama-3.1-405B-Instruct", // The Beast
                    messages: [
                        { role: "system", content: sysPrompt },
                        { role: "user", content: userText }
                    ],
                    temperature: 0.7,
                    max_tokens: 250 // Voice ke liye chhota answer
                })
            });

            const llmData = await llmResponse.json();
            replyText = llmData.choices?.[0]?.message?.content || "Sorry, main soch nahi pa raha hu.";
        }

        // STEP 3: SPEAK (Deepgram Aura TTS)
        // Clean markdown for better speech
        const cleanText = replyText.replace(/[*#`]/g, '').replace(/\[.*?\]/g, ''); 

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

        return res.status(200).json({ 
            audio: audioBase64, 
            text: replyText 
        });
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (SambaNova Only)
    // =================================================================
    if (mode === 'text') {
      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) finalSystemPrompt = systemInstruction.parts[0].text;
      
      let userMessage = contents[0].parts.map(p => p.text).join('\n');

      const response = await fetch("https://api.sambanova.ai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "Meta-Llama-3.1-405B-Instruct",
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      const data = await response.json();
      return res.status(200).json({ text: data.choices?.[0]?.message?.content });
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
    return res.status(500).json({ error: error.message });
  }
                  }
