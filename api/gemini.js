// api/gemini.js - FIXED PAYLOAD FOR V1
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
    const modelName = "gemini-1.5-flash"; 
    
    // v1 Endpoint standard format
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
    
    // 🔥 PAYLOAD RE-STRUCTURE: Stable API field naming
    let payload = {
      contents: contents,
      generationConfig: req.body.generationConfig || { temperature: 0.7 }
    };

    // Agar system instruction hai, to use correctly structure karo
    if (systemInstruction) {
        // v1 API expects system_instruction (with underscore) or inside specific field
        // Sabse safe tarikha: System instruction ko contents ke pehle part mein daalna 
        // ya stable API ke according structure karna:
        payload.system_instruction = typeof systemInstruction === 'string' 
            ? { parts: [{ text: systemInstruction }] } 
            : systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error Detail:", JSON.stringify(data));
      return res.status(response.status).json({ 
          error: data.error?.message || "Model failed. Please try again." 
      });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahta hoon, main samajh nahi paya.";

    // Image logic (Pollinations)
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "educational diagram");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(200).json({ text: aiText, audio: null });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", text: error.message });
  }
}
