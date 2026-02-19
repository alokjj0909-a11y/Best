// api/gemini.js - ULTIMATE VISION & STABLE CHAT
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { mode, contents, systemInstruction } = req.body;

    // 1. IMAGE GENERATION (Smart Class)
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "educational diagram");
       const seed = Math.floor(Math.random() * 10000);
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${seed}`;
       return res.status(200).json({ image: imageUrl });
    }

    // 2. TEXT & VISION HANDLING
    let userPrompt = "";
    let base64Image = null;

    if (contents && contents[0]?.parts) {
        contents[0].parts.forEach(part => {
            if (part.text) userPrompt += part.text + " ";
            // Frontend 'inlineData' bhej raha hai
            if (part.inlineData?.data) base64Image = part.inlineData.data;
        });
    }

    const persona = typeof systemInstruction === 'string' 
        ? systemInstruction 
        : (systemInstruction?.parts?.[0]?.text || "You are PadhaiSetu, a helpful AI tutor.");

    const messages = [{ role: "system", content: persona }];

    if (base64Image) {
        // 🔥 STABLE VISION PAYLOAD: ChatGPT-4o format
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userPrompt.trim() || "Analyze this image and solve the questions if any." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
        });
    } else {
        messages.push({ role: "user", content: userPrompt.trim() || "Hello" });
    }

    // 🔥 USING 'openai' MODEL: Most stable on Pollinations for Vision
    const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: messages,
            model: 'openai', 
            seed: Math.floor(Math.random() * 1000),
            private: true
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || "Pollinations API failed");
    }
    
    const aiText = await response.text();

    return res.status(200).json({ text: aiText, audio: null });

  } catch (error) {
    console.error("Backend Crash Log:", error);
    // User ko generic error ke bajaye thoda helpful message dena
    return res.status(200).json({ 
        text: "⚠️ System thoda busy hai, kripya 2 second ruk kar dubara koshish karein.", 
        audio: null 
    });
  }
}
