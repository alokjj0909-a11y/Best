// api/gemini.js - VISION SUPPORTED VERSION
// This handles Text, Voice, and Question Paper Solving (Vision)

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } }, // Size increased for images
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; // Put your Free Key in Vercel Env

  try {
    const { mode, contents, systemInstruction } = req.body;

    // 1. Vision Logic for Swadhyay / Chat with Image
    // We use gemini-1.5-flash because it's fast and FREE for vision tasks
    const model = "gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

    const payload = {
      contents: contents, // Frontend (index.html) already sends correct format
      systemInstruction: systemInstruction,
      generationConfig: req.body.generationConfig || { temperature: 0.7 }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Google API Error" });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahta hoon, main samajh nahi paya.";

    // 2. Handle Image Generation (Pollinations Backup)
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "education");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    // 3. Output
    return res.status(200).json({ 
        text: aiText, 
        audio: null // Voice will be handled by Browser TTS as requested
    });

  } catch (error) {
    return res.status(500).json({ error: "Server Error", text: error.message });
  }
}
