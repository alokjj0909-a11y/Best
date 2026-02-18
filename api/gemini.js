// api/gemini.js - HYBRID VOICE ENGINE (Indian Accent Fix)
// 1. English -> Deepgram Aura (Human-like)
// 2. Hindi/Gujarati -> Google TTS API (Correct Pronunciation)
// 3. Brain -> Pollinations (Free)

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

    // 🔥 HELPER: Language Detector
    const detectLanguage = (text) => {
        if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi
        if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'; // Gujarati
        return 'en'; // Default to English
    };

    // 🔥 HELPER: Pollinations AI (Free Brain)
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
    // 🎤 MODE 1: VOICE PROCESSING
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // PART A: SUNNA (Deepgram Universal)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                if (!DEEPGRAM_KEY) throw new Error("Key Missing");
                
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
                return res.status(200).json({ text: "Mic Error. Check Key.", audio: null });
            }
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // PART B: SOCHNA (Pollinations AI)
        let replyText = userText;
        if (!isTTSRequest && userText) {
            let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            replyText = await thinkWithPollinations([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ]);
        }

        // PART C: BOLNA (Smart Hybrid TTS) 🗣️
        try {
            const lang = detectLanguage(replyText);
            let audioBase64 = null;

            if (lang === 'en' && DEEPGRAM_KEY) {
                // 👉 ENGLISH? Use Deepgram (Best Quality)
                const ttsResponse = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
                    method: "POST",
                    headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ text: replyText.replace(/[*#]/g, '') })
                });
                if (ttsResponse.ok) {
                    const arrayBuffer = await ttsResponse.arrayBuffer();
                    audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                }
            } else {
                // 👉 HINDI/GUJARATI? Use Google TTS Hack (Better Accent)
                // Note: Google TTS returns MP3 directly. It's free and supports Hindi perfectly.
                const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(replyText)}&tl=${lang}&client=tw-ob`;
                const gResponse = await fetch(googleUrl);
                if (gResponse.ok) {
                    const arrayBuffer = await gResponse.arrayBuffer();
                    audioBase64 = Buffer.from(arrayBuffer).toString('base64');
                }
            }

            // Agar Audio mil gaya to bhejo, nahi to Text bhejo (Frontend Fallback karega)
            return res.status(200).json({ 
                audio: audioBase64, 
                text: replyText 
            });

        } catch (e) {
            console.error("TTS Error:", e);
            return res.status(200).json({ text: replyText });
        }
    }

    // Text Mode
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

    // Image Mode
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
