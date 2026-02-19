// api/gemini.js - VERCEL DEPLOYMENT VERSION
export const config = {
  maxDuration: 60, // Vercel Pro allows up to 300, Free is usually 10-60
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  // CORS Headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { mode, contents, systemInstruction } = req.body;

    // 1. SMART CLASS IMAGE GENERATION (Pollinations Flux)
    if (mode === 'image') {
       const promptText = contents?.[0]?.parts?.[0]?.text || "educational diagram";
       const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random() * 10000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    // 2. TEXT & VISION HANDLING (Pollinations OpenAI Model)
    let userPrompt = "";
    let base64Image = null;

    if (contents && contents[0]?.parts) {
        contents[0].parts.forEach(part => {
            if (part.text) userPrompt += part.text + " ";
            if (part.inlineData?.data) base64Image = part.inlineData.data;
        });
    }

    const persona = typeof systemInstruction === 'string' 
        ? systemInstruction 
        : (systemInstruction?.parts?.[0]?.text || "You are PadhaiSetu, a helpful AI tutor.");

    const messages = [{ role: "system", content: persona }];

    if (base64Image) {
        // 🔥 STABLE VISION FORMAT for Pollinations OpenAI
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userPrompt.trim() || "Analyze this question paper." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
        });
    } else {
        messages.push({ role: "user", content: userPrompt.trim() || "Hello" });
    }

    // Call Pollinations with OpenAI model (Strong Vision Support)
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

    if (!response.ok) throw new Error("Pollinations Service Down");
    const aiText = await response.text();

    return res.status(200).json({ text: aiText, audio: null });

  } catch (error) {
    console.error("Vercel Backend Error:", error);
    return res.status(500).json({ error: "Server Error", text: error.message });
  }
}
