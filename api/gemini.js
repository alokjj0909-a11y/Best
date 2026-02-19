// api/gemini.js - POLLINATIONS VISION + FLUX IMAGE

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } }, // बड़ी images के लिए
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, prompt, systemInstruction } = req.body;

    // 🔥 1. BRAIN: Pollinations ChatGPT Helper (Text + Vision)
    const thinkWithPollinations = async (messages) => {
        try {
            // Vision के लिए special handling
            const response = await fetch('https://text.pollinations.ai/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messages,
                    model: 'openai', // GPT-4o mini (vision capable)
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
    // 🎤 MODE: TEXT (with optional image)
    // =================================================================
    if (mode === 'text') {
        // Check if image is present in contents
        let userText = "";
        let hasImage = false;
        let imageData = null;

        // Parse contents to check for image
        if (contents && contents[0] && contents[0].parts) {
            for (const part of contents[0].parts) {
                if (part.text) {
                    userText += part.text + "\n";
                }
                if (part.inlineData) {
                    hasImage = true;
                    imageData = part.inlineData.data; // base64 image
                }
            }
        }

        // Prepare messages for Pollinations
        let messages = [];

        // System prompt
        if (systemInstruction) {
            messages.push({ 
                role: "system", 
                content: typeof systemInstruction === 'string' 
                    ? systemInstruction 
                    : systemInstruction.parts?.[0]?.text || "You are PadhaiSetu, a helpful AI tutor."
            });
        } else {
            messages.push({ role: "system", content: "You are PadhaiSetu, a helpful AI tutor." });
        }

        // User message with or without image
        if (hasImage && imageData) {
            // Vision mode - send image as base64
            messages.push({
                role: "user",
                content: [
                    { type: "text", text: userText || "What is in this image?" },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageData}` } }
                ]
            });
        } else {
            // Text only mode
            messages.push({ role: "user", content: userText || "Hello" });
        }

        // Get response from Pollinations
        const replyText = await thinkWithPollinations(messages);

        return res.status(200).json({ text: replyText });
    }

    // =================================================================
    // 🎨 MODE: IMAGE GENERATION (Pollinations Flux)
    // =================================================================
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    // =================================================================
    // 🎵 MODE: TTS (Browser fallback)
    // =================================================================
    if (mode === 'tts') {
        // Browser TTS will handle this
        return res.status(200).json({ audio: null });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Kuch gadbad ho gayi hai." });
  }
}
