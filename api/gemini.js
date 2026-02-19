// api/gemini.js - FIXED STABLE VERSION
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

    // 🔥 FIX: v1 API aur gemini-1.5-flash ka stable path use kar rahe hain
    const model = "gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

    const payload = {
      contents: contents,
      // Flash model ke liye system instruction ko contents mein merge karna safe hota hai
      generationConfig: req.body.generationConfig || { temperature: 0.7 }
    };

    // Agar system instruction hai, to use payload mein add karo
    if (systemInstruction) {
        payload.systemInstruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      // Agar abhi bhi error aaye, to v1beta try karne ka fallback
      console.error("Primary API failed, trying v1beta...");
      const betaUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
      const betaRes = await fetch(betaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
      });
      const betaData = await betaRes.json();
      if (!betaRes.ok) {
          return res.status(betaRes.status).json({ error: betaData.error?.message || "Google API Error" });
      }
      return res.status(200).json({ text: betaData.candidates?.[0]?.content?.parts?.[0]?.text, audio: null });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahta hoon, main samajh nahi paya.";

    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    return res.status(200).json({ text: aiText, audio: null });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", text: error.message });
  }
}
