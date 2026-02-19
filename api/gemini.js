// api/gemini.js - POLLINATIONS POWER-VISION (Best for Swadhyay Papers)
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
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*10000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    // 2. TEXT & VISION HANDLING
    let userText = "";
    let base64Image = null;

    if (contents && contents[0]?.parts) {
        contents[0].parts.forEach(part => {
            if (part.text) userText += part.text + " ";
            if (part.inlineData?.data) base64Image = part.inlineData.data;
        });
    }

    const persona = typeof systemInstruction === 'string' 
        ? systemInstruction 
        : (systemInstruction?.parts?.[0]?.text || "You are PadhaiSetu, a helpful teacher.");

    const messages = [{ role: "system", content: persona }];

    if (base64Image) {
        // 🔥 IMPROVED VISION PAYLOAD
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userText.trim() || "Analyze and solve this question paper completely." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
        });
    } else {
        messages.push({ role: "user", content: userText.trim() || "Hello" });
    }

    // 🔥 USING 'p1' MODEL: Pollinations का सबसे एडवांस विजन मॉडल
    const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: messages,
            model: 'p1', // Much better at OCR and Vision tasks
            seed: Math.floor(Math.random() * 1000),
            private: true
        })
    });

    if (!response.ok) throw new Error("Pollinations Connection Error");
    const aiText = await response.text();

    return res.status(200).json({ text: aiText, audio: null });

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Kripya dobara koshish karein." });
  }
  }
