// api/gemini.js - POLLINATIONS CHATGPT-4O VISION VERSION
export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } }, // Vision ke liye size badhaya hai
};

export default async function handler(req, res) {
  // CORS Headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { mode, contents, systemInstruction } = req.body;

    // 1. IMAGE GENERATION MODE (Smart Class visuals)
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "educational diagram");
       const seed = Math.floor(Math.random() * 10000);
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${seed}`;
       return res.status(200).json({ image: imageUrl });
    }

    // 2. TEXT & VISION MODE (Chat + Swadhyay Paper Solver)
    let userPrompt = "";
    let base64Image = null;

    // Frontend se aane wale contents se Text aur Image ko alag karna
    if (contents && contents[0] && contents[0].parts) {
        contents[0].parts.forEach(part => {
            if (part.text) userPrompt += part.text + " ";
            if (part.inlineData && part.inlineData.data) {
                base64Image = part.inlineData.data; // Paper ki photo yahan milegi
            }
        });
    }

    // Persona logic: Badi Didi, Sir, etc.
    const persona = typeof systemInstruction === 'string' 
        ? systemInstruction 
        : (systemInstruction?.parts?.[0]?.text || "You are PadhaiSetu, a helpful Indian AI tutor.");

    // Pollinations ke liye Messages Array taiyar karna
    const messages = [
        { role: "system", content: persona }
    ];

    if (base64Image) {
        // 🔥 VISION LOGIC: Image ko ChatGPT-4o (openai) ke standard format mein bhejna
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userPrompt.trim() || "Is question paper ko solve karke do." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
        });
    } else {
        // Normal text chat
        messages.push({ role: "user", content: userPrompt.trim() || "Hello" });
    }

    // Pollinations API Call (Using ChatGPT-4o / openai)
    const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: messages,
            model: 'openai', // Isme Vision support built-in hai
            seed: Math.floor(Math.random() * 1000)
        })
    });

    if (!response.ok) {
        throw new Error("Pollinations API connection failed");
    }

    const aiResponseText = await response.text();

    // Final result dena (Audio null hai taaki browser ki awaz chale)
    return res.status(200).json({ 
        text: aiResponseText || "Maafi chahta hoon, main ise samajh nahi paya.", 
        audio: null 
    });

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ 
        error: "Server Error", 
        text: "Piche se kuch gadbad hui hai, kripya dobara koshish karein." 
    });
  }
}
