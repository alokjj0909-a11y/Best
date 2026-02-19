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
    
    // 🔥 सुधार 1: gemini-1.5-flash-latest का उपयोग
    const modelName = "gemini-1.5-flash-latest"; 
    
    // 🔥 सुधार 2: v1 (Stable) एंडपॉइंट का उपयोग
    let url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
    
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

    // 🔄 FALLBACK: यदि v1 काम नहीं करता, तो v1beta पर प्रयास करें
    if (!response.ok) {
      console.warn("v1 failed or model not found, trying fallback...");
      url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_API_KEY}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      data = await response.json();
    }

    if (!response.ok) {
      // यदि दोनों एंडपॉइंट फेल होते हैं, तो एरर दिखाएं
      return res.status(response.status).json({ 
        error: data.error?.message || "Model access error. Please check your API key permissions." 
      });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Maafi chahta hoon, main samajh nahi paya.";

    // Image logic (Pollinations) - No change needed here
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
