// api/gemini.js - THE BULLETPROOF FIX (No Field Errors)
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
    
    // Sabse simple v1 Endpoint
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
    
    // 🔥 TRICK: System Instruction ko alag se bhejte hi Error aata hai.
    // Isliye hum use User Content ke sabse pehle part mein "Inject" kar rahe hain.
    let finalContents = [...contents];

    if (systemInstruction) {
        const instructionText = typeof systemInstruction === 'string' 
            ? systemInstruction 
            : (systemInstruction.parts?.[0]?.text || "");
        
        if (instructionText) {
            // Content ke shuruat mein Persona Rules daal rahe hain taaki AI unhe follow kare
            finalContents[0].parts.unshift({ text: `INSTRUCTIONS: ${instructionText}\n\nUSER QUERY:` });
        }
    }

    const payload = {
      contents: finalContents,
      generationConfig: req.body.generationConfig || { temperature: 0.7 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      // Agar gemini-1.5-flash abhi bhi nakhre kare, to v1beta fallback (Safe side)
      const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
      const fbRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      const fbData = await fbRes.json();
      if (!fbRes.ok) return res.status(fbRes.status).json({ error: fbData.error?.message || "Model Issue" });
      return res.status(200).json({ text: fbData.candidates?.[0]?.content?.parts?.[0]?.text, audio: null });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahta hoon, main samajh nahi paya.";

    // Image logic for Smart Class (Pollinations)
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
