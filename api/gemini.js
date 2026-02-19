// api/gemini.js - ULTIMATE VISION & CHAT FIX
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

  try {
    const { mode, contents, systemInstruction } = req.body;

    // 🔥 FIX: Free Tier के लिए सबसे स्टेबल मॉडल और एंडपॉइंट
    const modelName = "gemini-1.5-flash"; 
    
    // ✅ NEW URL STRUCTURE: v1 का सही रास्ता
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
    
    let payload = {
      contents: contents,
      generationConfig: req.body.generationConfig || { temperature: 0.7 }
    };

    // System Instructions को सही जगह डालना
    if (systemInstruction) {
        payload.systemInstruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // 🛑 ERROR CHECKING
    if (!response.ok) {
      console.error("Gemini API Error:", data);
      return res.status(response.status).json({ 
          error: data.error?.message || "Model connection failed. Check API Key." 
      });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahta hoon, main samajh nahi paya.";

    // IMAGE GENERATION (Pollinations)
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "educational diagram");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    // FINAL OUTPUT
    return res.status(200).json({ text: aiText, audio: null });

  } catch (error) {
    console.error("Server Crash Error:", error);
    return res.status(500).json({ error: "Server Error", text: error.message });
  }
}
