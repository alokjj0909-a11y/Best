// api/gemini.js - POLLINATIONS + DEEPGRAM HYBRID
// Thinking: Pollinations (Unlimited/Free) | Voice: Deepgram ($200 Free Credit)

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  // CORS Headers setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;
    
    // Sirf Deepgram key chahiye. SambaNova ki ab zarurat nahi!
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    if (!DEEPGRAM_KEY) return res.status(500).json({ error: "Deepgram Key Missing" });

    // 🔥 HELPER: Pollinations AI for Thinking (No Key Needed)
    const thinkWithPollinations = async (messages) => {
        try {
            // Pollinations ka OpenAI compatible endpoint (Free)
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    model: 'openai', // GPT-4o-Mini equivalent (Smart & Fast)
                    seed: Math.floor(Math.random() * 1000)
                })
            });

            if (!response.ok) throw new Error("Pollinations Error");
            
            // Pollinations seedha text return karta hai
            const text = await response.text();
            return text || "Hmm, main samajh nahi paaya.";
        } catch (e) {
            console.error("Pollinations Failed:", e);
            return "Server connection weak hai, dobara boliye.";
        }
    };

    // =================================================================
    // 🎤 MODE 1: VOICE (Deepgram Ears + Pollinations Brain + Deepgram Mouth)
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // 1. SUNNA (Deepgram STT)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                    method: "POST",
                    headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "audio/wav" },
                    body: audioBuffer
                });
                if (!sttResponse.ok) throw new Error("Mic Error");
                const sttData = await sttResponse.json();
                userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                
                if (!userText) return res.status(200).json({ text: "...", audio: null });
            } catch (e) {
                return res.status(200).json({ text: "Mic problem", audio: null });
            }
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // 2. SOCHNA (Pollinations AI - FREE BRAIN) 🧠
        let replyText = userText;
        if (!isTTSRequest && userText) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish (Hindi+English). Keep it short and natural.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            // Yahan hum SambaNova ki jagah Pollinations use kar rahe hain
            replyText = await thinkWithPollinations([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ]);
        }

        // 3. BOLNA (Deepgram Aura - FREE VOICE CREDIT) 🗣️
        try {
            const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
            });

            if (!ttsResponse.ok) throw new Error("TTS Failed");
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
            return res.status(200).json({ audio: audioBase64, text: replyText });
        } catch (e) {
            // Agar audio fail ho, to text bhejo
            return res.status(200).json({ text: replyText });
        }
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (Pollinations AI)
    // =================================================================
    if (mode === 'text') {
      let sysP = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) sysP = systemInstruction.parts[0].text;
      let userM = contents[0].parts.map(p => p.text).join('\n');

      const text = await thinkWithPollinations([
          { role: "system", content: sysP },
          { role: "user", content: userM }
      ]);
      
      return res.status(200).json({ text: text });
    }

    // =================================================================
    // 🎨 MODE 3: IMAGE (Pollinations Flux)
    // =================================================================
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server Error", text: "Something went wrong." });
  }
              }
