// api/gemini.js - FINAL GOLDEN VERSION
// 1. Mic: Supports 'audio/webm' (Fixes Mobile/Android issues)
// 2. Brain: Pollinations AI (Unlimited Free Thinking)
// 3. Speaker: Deepgram Aura (Human-like Voice)

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  // CORS Headers (Browser connection ke liye zaroori)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    // Check Key
    if (!DEEPGRAM_KEY) return res.status(500).json({ error: "Deepgram Key Missing" });

    // 🔥 HELPER: Pollinations AI (Free Brain)
    const thinkWithPollinations = async (messages) => {
        try {
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    model: 'openai', // Free & Smart (GPT-4o-Mini equivalent)
                    seed: Math.floor(Math.random() * 1000)
                })
            });

            if (!response.ok) throw new Error("Pollinations Error");
            const text = await response.text();
            return text || "Thinking...";
        } catch (e) {
            console.error("Brain Error:", e);
            return "Connection weak. Please try again.";
        }
    };

    // =================================================================
    // 🎤 MODE 1: VOICE / AUDIO PROCESSING
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // PART A: SUNNA (Deepgram STT)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                // 👇 CRITICAL FIX: 'audio/webm' for Android/Mobile
                const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                    method: "POST",
                    headers: { 
                        "Authorization": `Token ${DEEPGRAM_KEY}`,
                        "Content-Type": "audio/webm" // ✅ Ye Android ke liye zaroori hai
                    },
                    body: audioBuffer
                });

                if (!sttResponse.ok) {
                    const errText = await sttResponse.text();
                    console.error("Deepgram STT Error:", errText);
                    throw new Error("Mic Error");
                }
                const sttData = await sttResponse.json();
                userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                
                // Agar kuch sunayi nahi diya
                if (!userText) return res.status(200).json({ text: "...", audio: null });

            } catch (e) {
                return res.status(200).json({ text: "Mic format error. Please reload.", audio: null });
            }
        } else if (isTTSRequest) {
            // Agar seedha bolne (TTS) ke liye aaya hai (Smart Class / Swadhyay)
            userText = contents[0].parts[0].text;
        }

        // PART B: SOCHNA (Pollinations AI) - Only if not direct TTS
        let replyText = userText;
        if (!isTTSRequest && userText) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            replyText = await thinkWithPollinations([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ]);
        }

        // PART C: BOLNA (Deepgram Aura TTS)
        try {
            const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
            });

            if (!ttsResponse.ok) throw new Error("TTS Failed");
            
            const arrayBuffer = await ttsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(arrayBuffer).toString('base64');

            // Success! Audio (MP3) aur Text dono bhejo
            return res.status(200).json({ audio: audioBase64, text: replyText });

        } catch (e) {
            console.error("TTS Error:", e);
            // Agar Audio fail ho, to kam se kam Text bhejo
            return res.status(200).json({ text: replyText });
        }
    }

    // =================================================================
    // 🧠 MODE 2: TEXT CHAT (Pollinations AI)
    // =================================================================
    if (mode === 'text') {
      let sysP = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) sysP = systemInstruction.parts[0].text;
      
      let userM = "";
      // Handle Image+Text or just Text
      if (contents[0].parts.length > 1 && contents[0].parts[1].text) {
          userM = `[User sent an image] ${contents[0].parts[1].text}`;
      } else {
          userM = contents[0].parts.map(p => p.text).join('\n');
      }

      const text = await thinkWithPollinations([
          { role: "system", content: sysP },
          { role: "user", content: userM }
      ]);
      
      return res.status(200).json({ text: text });
    }

    // =================================================================
    // 🎨 MODE 3: IMAGE GENERATION (Pollinations Flux)
    // =================================================================
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       // Pollinations ka Naya Flux Model (Best Quality)
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Critical Server Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Something went wrong." });
  }
          }
