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
    const model = "gemini-1.5-flash"; 
    
    // 🔥 Sabse pehle v1 (Stable) try karte hain
    let url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
    
    let payload = {
      contents: contents,
      generationConfig: req.body.generationConfig || { temperature: 0.7 }
    };
    if (systemInstruction) payload.systemInstruction = systemInstruction;

    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    let data = await response.json();

    // 🔄 FALLBACK: Agar v1 fail hota hai to v1beta try karein
    if (!response.ok) {
      console.warn("v1 failed, trying v1beta...");
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      data = await response.json();
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Google API Error" });
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
