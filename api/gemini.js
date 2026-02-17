// api/gemini.js - DIAGNOSTIC MODE (To Find the Real Error)

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '4mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, systemInstruction } = req.body;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;
    const SAMBANOVA_KEY = process.env.SAMBANOVA_KEY;

    if (!DEEPGRAM_KEY) return res.status(500).json({ error: "Deepgram Key Missing" });
    if (!SAMBANOVA_KEY) return res.status(500).json({ error: "SambaNova Key Missing" });

    // =================================================================
    // 🎤 VOICE MODE
    // =================================================================
    const hasAudioInput = contents?.[0]?.parts?.some(p => p.inlineData && p.inlineData.mimeType.startsWith('audio'));
    const isTTSRequest = mode === 'tts';

    if (isTTSRequest || (mode === 'text' && hasAudioInput)) {
        let userText = "";

        // 1. LISTEN (Deepgram)
        if (hasAudioInput && !isTTSRequest) {
            const audioPart = contents[0].parts.find(p => p.inlineData);
            const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
            try {
                const sttResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&language=en-IN", {
                    method: "POST",
                    headers: { "Authorization": `Token ${DEEPGRAM_KEY}`, "Content-Type": "audio/wav" },
                    body: audioBuffer
                });
                if (!sttResponse.ok) {
                     const errText = await sttResponse.text();
                     throw new Error(`Deepgram Ear Error: ${errText}`);
                }
                const sttData = await sttResponse.json();
                userText = sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript;
                if (!userText) return res.status(200).json({ text: "...", audio: null });
            } catch (e) {
                return res.status(200).json({ text: `Mic Error: ${e.message}` });
            }
        } else if (isTTSRequest) {
            userText = contents[0].parts[0].text;
        }

        // 2. THINK (SambaNova - With Error Reporting)
        let replyText = userText;
        if (!isTTSRequest && userText) {
            try {
                let sysPrompt = "You are PadhaiSetu. Reply in Hinglish. Keep it short.";
                if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

                // Trying ONLY the Fastest Model first to see the specific error
                const llmResponse = await fetch("https://api.sambanova.ai/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${SAMBANOVA_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: "Meta-Llama-3.1-8B-Instruct",
                        messages: [{ role: "system", content: sysPrompt }, { role: "user", content: userText }],
                        temperature: 0.6,
                        max_tokens: 150
                    })
                });

                if (!llmResponse.ok) {
                    // 🔥 CAPTURE THE REAL ERROR
                    const errText = await llmResponse.text();
                    console.error("SambaNova Error:", errText);
                    // Return the error to the user so we can see it
                    replyText = `SambaNova Error (${llmResponse.status}): ${errText.substring(0, 100)}`;
                } else {
                    const llmData = await llmResponse.json();
                    replyText = llmData.choices?.[0]?.message?.content || "Empty Response";
                }
            } catch (e) {
                replyText = `Connection Error: ${e.message}`;
            }
        }

        // 3. SPEAK (Deepgram Aura)
        try {
            // Clean text to avoid reading error codes as speech if possible, but for debug let it read
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
            return res.status(200).json({ text: replyText }); // Send text even if audio fails
        }
    }

    // Text Mode
    if (mode === 'text') {
       // ... simplified for debug ...
       return res.status(200).json({ text: "Text mode disabled for Voice debugging." });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", text: error.message });
  }
      }
