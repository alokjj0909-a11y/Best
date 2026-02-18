// api/gemini.js - OPTIMIZED FOR NEW HTML (Fast Text & Hybrid Voice)

export const config = {
  maxDuration: 60, // Vercel limit
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  // 1. Security Headers (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, voiceId, systemInstruction } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    // 🔥 1. CHARACTER VOICE MAPPING (HTML se matching)
    const voiceMap = {
        'Aoede': 'aura-asteria-en',  // Badi Didi (Soft Female)
        'Fenrir': 'aura-orion-en',   // Bada Bhai (Confident Male)
        'Iapetus': 'aura-arc-en',    // Dost (Cool Male)
        'Orus': 'aura-perseus-en'    // Sir (Deep Male)
    };
    // Default fallback
    const selectedModel = voiceMap[voiceId] || 'aura-asteria-en';

    // 🔥 2. HELPER: Indian Language Detector
    const isIndianLanguage = (text) => {
        // Checks for Hindi, Gujarati, Marathi, etc. characters
        return /[\u0900-\u097F\u0A80-\u0AFF]/.test(text);
    };

    // 🔥 3. HELPER: Pollinations AI (The Brain)
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
            return "Connection weak. Please retry.";
        }
    };

    // =================================================================
    // 🎤 MAIN LOGIC: TEXT & VOICE HANDLING
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || mode === 'text') {
        let userText = "";

        // 👉 STEP A: LISTENING (Deepgram STT) - Only if Mic used
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                if (!DEEPGRAM_KEY) throw new Error("Deepgram Key Missing");
                
                // 🛠️ FIX: 'octet-stream' prevents Android Mic Errors
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
                return res.status(200).json({ text: "Mic format error. Please Reload.", audio: null });
            }
        } else {
            // Text Input Handling
            if (isTTSRequest) {
                userText = contents[0].parts[0].text; // Direct text for TTS
            } else if (contents[0].parts.length > 1 && contents[0].parts[1].text) {
                userText = `[User sent image] ${contents[0].parts[1].text}`; // Image Analysis
            } else {
                userText = contents[0].parts.map(p => p.text).join('\n'); // Plain Text
            }
        }

        // 👉 STEP B: THINKING (Pollinations AI)
        // Agar TTS request hai (Smart Class se), toh sochna skip karo, seedha text lo.
        let replyText = userText;
        if (!isTTSRequest && userText) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            replyText = await thinkWithPollinations([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ]);
        }

        // 👉 STEP C: SPEAKING (Hybrid System)
        try {
            // Rule 1: Indian Language? -> Send NULL Audio.
            // (Frontend will use Phone's Voice for Hindi/Gujarati)
            if (isIndianLanguage(replyText)) {
                return res.status(200).json({ 
                    text: replyText, 
                    audio: null 
                });
            } 
            
            // Rule 2: English? -> Use Deepgram with Character Voice.
            if (!DEEPGRAM_KEY) throw new Error("No Key");
            
            const ttsResponse = await fetch(`https://api.deepgram.com/v1/speak?model=${selectedModel}`, {
                method: "POST",
                headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
            });

            if (ttsResponse.ok) {
                const arrayBuffer = await ttsResponse.arrayBuffer();
                const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                return res.status(200).json({ audio: audioBase64, text: replyText });
            } else {
                // Fallback to browser voice if Deepgram fails
                return res.status(200).json({ text: replyText, audio: null });
            }

        } catch (e) {
            return res.status(200).json({ text: replyText, audio: null });
        }
    }

    // =================================================================
    // 🎨 MODE: IMAGE GENERATION (Backup)
    // =================================================================
    // Note: Frontend ab khud handle kar raha hai, par ye backup ke liye rakha hai.
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       // Pollinations Flux Model
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error", text: "System overload." });
  }
        }
