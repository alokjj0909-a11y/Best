// api/gemini.js - THE MASTERPIECE (Supports Characters + Mic Fix)

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  // 1. CORS Headers (Security Handshake)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, voiceId, systemInstruction } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    // 🔥 CHARACTER MAP (Frontend IDs -> Deepgram Models)
    const voiceMap = {
        'Aoede': 'aura-asteria-en',  // Badi Didi (Soft Female)
        'Fenrir': 'aura-orion-en',   // Bada Bhai (Confident Male)
        'Iapetus': 'aura-arc-en',    // Dost (Cool Male)
        'Orus': 'aura-perseus-en'    // Sir (Deep Male)
    };
    
    // Default to Didi if no ID sent
    const selectedModel = voiceMap[voiceId] || 'aura-asteria-en';

    // 🔥 HELPER: Detect Indian Languages (Hindi/Gujarati)
    const isIndianLanguage = (text) => {
        return /[\u0900-\u097F\u0A80-\u0AFF]/.test(text);
    };

    // 🔥 HELPER: Pollinations AI (ChatGPT Brain)
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
    // 🎤 MODE: VOICE & TEXT INTERACTION
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || mode === 'text') {
        let userText = "";

        // 👉 PART A: LISTENING (Deepgram STT)
        // Only run if user sent audio (Mic input)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                if (!DEEPGRAM_KEY) throw new Error("Key Missing");
                
                // 🔥 ANDROID FIX: 'application/octet-stream'
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
                return res.status(200).json({ text: "Mic Error. Reload.", audio: null });
            }
        } else {
            // Text Input Handling
            if (isTTSRequest) {
                userText = contents[0].parts[0].text; // For TTS mode
            } else if (contents[0].parts.length > 1 && contents[0].parts[1].text) {
                userText = `[User sent image] ${contents[0].parts[1].text}`; // Image + Text
            } else {
                userText = contents[0].parts.map(p => p.text).join('\n'); // Plain Text
            }
        }

        // 👉 PART B: THINKING (Pollinations AI)
        // Skip thinking if it's just a TTS request (Smart Class sends text directly)
        let replyText = userText;
        if (!isTTSRequest && userText) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            replyText = await thinkWithPollinations([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ]);
        }

        // 👉 PART C: SPEAKING (Hybrid TTS)
        try {
            // Rule 1: Indian Language? -> Send NULL Audio.
            // Frontend will handle it with 'speechSynthesis' (Browser Voice).
            if (isIndianLanguage(replyText)) {
                return res.status(200).json({ 
                    text: replyText, 
                    audio: null 
                });
            } 
            
            // Rule 2: English? -> Use Deepgram with selected Character Voice.
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
                // If Deepgram fails, fallback to browser voice
                return res.status(200).json({ text: replyText, audio: null });
            }

        } catch (e) {
            return res.status(200).json({ text: replyText, audio: null });
        }
    }

    // =================================================================
    // 🎨 MODE: IMAGE GENERATION (Pollinations Flux)
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
