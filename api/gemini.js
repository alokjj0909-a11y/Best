// api/gemini.js - LIGHTWEIGHT VERSION (For Puter.js Frontend)
// 1. Mic: Deepgram STT (Fixes Android Mic Error with 'octet-stream')
// 2. Brain: Pollinations AI (ChatGPT Mode - As requested)
// 3. Speaker: Handled by Frontend (Puter.js), so no TTS code here.

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

    // 🔥 1. HELPER: Pollinations AI (Ye wahi ChatGPT wala code hai, same to same)
    const thinkWithPollinations = async (messages) => {
        try {
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    model: 'openai', 
                    seed: Math.floor(Math.random() * 1000)
                })
            });
            if (!response.ok) throw new Error("Pollinations Error");
            const text = await response.text();
            return text || "Thinking...";
        } catch (e) {
            return "Connection weak.";
        }
    };

    // =================================================================
    // 🎤 MODE 1: VOICE / TEXT CHAT
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));

    if (mode === 'text' || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // 👉 PART A: SUNNA (Deepgram STT) - Sirf Input ke liye
        if (hasAudioInput) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                if (!DEEPGRAM_KEY) throw new Error("Deepgram Key Missing");
                
                // 🔥 MASTER FIX: 'application/octet-stream' 
                // Ye Android ke WebM/WAV jhagde ko khatam karta hai.
                const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                    method: "POST",
                    headers: { 
                        "Authorization": `Token ${DEEPGRAM_KEY}`,
                        "Content-Type": "application/octet-stream" 
                    },
                    body: audioBuffer
                });

                if (!sttResponse.ok) throw new Error("Mic Error");
                const sttData = await sttResponse.json();
                userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                
                if (!userText) return res.status(200).json({ text: "...", audio: null });
            } catch (e) {
                // Agar Mic fail ho, to User ko batao
                return res.status(200).json({ text: "Mic format error. Please reload.", audio: null });
            }
        } else {
            // Agar Audio nahi hai, to direct text uthao
            if (contents[0].parts.length > 1 && contents[0].parts[1].text) {
                // Image + Text case
                userText = `[User sent image] ${contents[0].parts[1].text}`;
            } else {
                // Plain Text case
                userText = contents[0].parts.map(p => p.text).join('\n');
            }
        }

        // 👉 PART B: SOCHNA (Pollinations AI)
        // Ye wahi logic hai jo aapne kaha "mat chhedna"
        let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
        if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

        const aiReply = await thinkWithPollinations([
            { role: "system", content: sysPrompt },
            { role: "user", content: userText }
        ]);

        // 👉 OUTPUT: Sirf Text bhejo (Audio ab Frontend Puter.js sambhalega)
        return res.status(200).json({ text: aiReply });
    }

    // =================================================================
    // 🎨 MODE 2: IMAGE GENERATION (Pollinations Flux)
    // =================================================================
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", text: "Something went wrong." });
  }
}
