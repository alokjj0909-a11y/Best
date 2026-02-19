// api/gemini.js - POLLINATIONS ONLY VERSION
// No Deepgram, No External TTS. 
// Uses Pollinations for ChatGPT Brain and Flux Image.

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

    // 🔥 1. BRAIN: Pollinations ChatGPT Helper
    const thinkWithPollinations = async (messages) => {
        try {
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    model: 'openai', // Using ChatGPT model
                    seed: Math.floor(Math.random() * 1000)
                })
            });
            if (!response.ok) throw new Error("Pollinations Brain Error");
            const text = await response.text();
            return text || "Maafi chahta hoon, main samajh nahi paya.";
        } catch (e) {
            return "Connection weak. Please try again.";
        }
    };

    // =================================================================
    // 🎤 MODE: TEXT & TTS REQUESTS
    // =================================================================
    if (mode === 'text' || mode === 'tts') {
        let userText = "";

        // Text input extraction
        if (mode === 'tts') {
            userText = contents[0].parts[0].text;
        } else {
            // Normal chat or Image analysis (handled as text prompt)
            userText = contents[0].parts.map(p => p.text || "[Attachment]").join('\n');
        }

        // Processing with AI
        let replyText = userText;
        if (mode !== 'tts') {
            let sysPrompt = "You are PadhaiSetu, a helpful human-like AI tutor. Reply in the same language as the user.";
            if (systemInstruction?.parts?.[0]?.text) sysPrompt = systemInstruction.parts[0].text;

            replyText = await thinkWithPollinations([
                { role: "system", content: sysPrompt },
                { role: "user", content: userText }
            ]);
        }

        // ✅ OUTPUT: Audio set to null so Frontend Browser Voice takes over.
        // Frontend (HTML) will use its fallbackTTS (Girl voice logic).
        return res.status(200).json({ 
            text: replyText, 
            audio: null 
        });
    }

    // =================================================================
    // 🎨 MODE: IMAGE GENERATION (Pollinations Flux)
    // =================================================================
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       // Creating direct HD Flux image URL
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Kuch gadbad ho gayi hai." });
  }
                  }
