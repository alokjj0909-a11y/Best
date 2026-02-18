// api/gemini.js - AUTO-DETECT FORMAT (Fixes 'Mic format error')
// 1. Mic: Auto-detects ANY audio format (WebM, MP4, WAV, OGG)
// 2. Brain: Pollinations AI (Free)
// 3. Speaker: Deepgram Aura

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

    if (!DEEPGRAM_KEY) return res.status(500).json({ error: "Deepgram Key Missing" });

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

        // PART A: SUNNA (Deepgram Auto-Detect)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                // 👇 BIG FIX: Removed 'Content-Type'. Deepgram will auto-detect now!
                const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                    method: "POST",
                    headers: { 
                        "Authorization": `Token ${DEEPGRAM_KEY}`
                        // "Content-Type": "audio/webm" <--- HATA DIYA (Auto-Detect ON)
                    },
                    body: audioBuffer
                });

                if (!sttResponse.ok) {
                    const err = await sttResponse.text();
                    console.error("Deepgram Error:", err);
                    throw new Error("Mic Error");
                }
                const sttData = await sttResponse.json();
                userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                
                if (!userText) return res.status(200).json({ text: "...", audio: null });
            } catch (e) {
                // Agar Deepgram fail ho, to error dikhao taaki pata chale
                return res.status(200).json({ text: "Mic format error. Please reload.", audio: null });
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
            return res.status(200).json({ audio: audioBase64, text: replyText });
        } catch (e) {
            return res.status(200).json({ text: replyText });
        }
    }

    // Text Mode
    if (mode === 'text') {
      let sysP = "You are a helpful AI tutor.";
      if (systemInstruction?.parts?.[0]?.text) sysP = systemInstruction.parts[0].text;
      
      let userM = "";
      if (contents[0].parts.length > 1 && contents[0].parts[1].text) {
          userM = `[User sent image] ${contents[0].parts[1].text}`;
      } else {
          userM = contents[0].parts.map(p => p.text).join('\n');
      }

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
