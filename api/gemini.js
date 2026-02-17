// api/gemini.js - THE ULTIMATE VOICE STACK (Groq + Deepgram)

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Audio upload ke liye limit badhayi
    },
  },
};

export default async function handler(req, res) {
  // CORS Setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;

    // KEYS CHECK
    const GROQ_KEY = process.env.GROQ_API_KEY;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    // Fallback keys (SambaNova/Google) for text/image modes
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    // =================================================================
    // 🎤 MODE 1: POWERFUL VOICE (Groq + Deepgram)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        
        if (!GROQ_KEY || !DEEPGRAM_KEY) {
            return res.status(500).json({ error: "Voice configuration missing (GROQ or DEEPGRAM key)." });
        }

        let responseText = "";

        // STEP 1: TRANSCRIBE AUDIO (Agar user ne bola hai)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const base64Audio = audioPart.inlineData.data;
            const audioBuffer = Buffer.from(base64Audio, 'base64');

            // Groq Whisper API Call (Multipart Form Data manually construct karna padega)
            const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
            let body = `--${boundary}\r\n`;
            body += 'Content-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3\r\n';
            body += `--${boundary}\r\n`;
            body += 'Content-Disposition: form-data; name="file"; filename="audio.webm"\r\n';
            body += 'Content-Type: audio/webm\r\n\r\n';
            
            const bodyHeader = Buffer.from(body, 'utf-8');
            const bodyFooter = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
            const finalBody = Buffer.concat([bodyHeader, audioBuffer, bodyFooter]);

            const transResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_KEY}`,
                    "Content-Type": `multipart/form-data; boundary=${boundary}`,
                },
                body: finalBody
            });

            if (!transResponse.ok) throw new Error(`Groq Hearing Failed: ${await transResponse.text()}`);
            const transData = await transResponse.json();
            const userText = transData.text;
            console.log("User said:", userText);

            // STEP 2: INTELLIGENT THINKING (Llama 3 on Groq)
            let sysPrompt = "You are PadhaiSetu, a helpful and energetic Indian tutor. Reply in Hinglish (Hindi+English mix). Keep it short and conversational.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            const chatResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile", // Super Fast & Smart
                    messages: [
                        { role: "system", content: sysPrompt },
                        { role: "user", content: userText }
                    ],
                    max_tokens: 200
                })
            });

            const chatData = await chatResponse.json();
            responseText = chatData.choices?.[0]?.message?.content || "Hmm, main samajh nahi paaya.";
        } 
        else if (isTTSRequest) {
            // Agar seedha text aaya hai bolne ke liye
            responseText = contents[0].parts[0].text;
        }

        // STEP 3: SPEAKING (Deepgram Aura) - The Real Magic
        // Remove Markdown for cleaner speech
        const cleanText = responseText.replace(/[*#]/g, ''); 
        
        // Deepgram call
        const deepgramRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
            method: "POST",
            headers: {
                "Authorization": `Token ${DEEPGRAM_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: cleanText })
        });

        if (!deepgramRes.ok) throw new Error("Deepgram Speaking Failed");

        const arrayBuffer = await deepgramRes.arrayBuffer();
        const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

        return res.status(200).json({ 
            audio: audioBase64, 
            text: responseText 
        });
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (SambaNova / Groq Backup)
    // =================================================================
    if (mode === 'text') {
      const apiKey = SAMBANOVA_KEY || GROQ_KEY; // Use whichever is available
      const apiUrl = SAMBANOVA_KEY ? "https://api.sambanova.ai/v1/chat/completions" : "https://api.groq.com/openai/v1/chat/completions";
      const modelName = SAMBANOVA_KEY ? "Meta-Llama-3.1-405B-Instruct" : "llama-3.3-70b-versatile";

      if (!apiKey) return res.status(500).json({ error: 'No Text API Key configured.' });

      let finalSystemPrompt = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) finalSystemPrompt = systemInstruction.parts[0].text;
      
      let userMessage = contents[0].parts.map(p => p.text).join('\n');

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelName,
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
    
