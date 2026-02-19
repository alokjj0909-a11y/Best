// api/gemini.js - POLLINATIONS VISION & CHAT (No Google API Needed)
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

    // 1. IMAGE GENERATION MODE (Smart Class)
    if (mode === 'image') {
       const prompt = encodeURIComponent(req.body.prompt || "educational diagram");
       const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
       return res.status(200).json({ image: imageUrl });
    }

    // 2. TEXT & VISION MODE (Chat & Swadhyay Solver)
    let userMessage = "";
    let base64Image = null;

    // Payload से टेक्स्ट और इमेज को अलग करना
    contents[0].parts.forEach(part => {
        if (part.text) userMessage += part.text + " ";
        if (part.inlineData) base64Image = part.inlineData.data; // Image found!
    });

    // System Persona तैयार करना
    const persona = typeof systemInstruction === 'string' 
        ? systemInstruction 
        : (systemInstruction?.parts?.[0]?.text || "You are a helpful AI tutor.");

    // Pollinations API के लिए मैसेज तैयार करना
    const messages = [
        { role: "system", content: persona }
    ];

    if (base64Image) {
        // 🔥 VISION SUPPORT: Image + Text Message
        messages.push({
            role: "user",
            content: [
                { type: "text", text: userMessage || "Solve this paper step by step." },
                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
            ]
        });
    } else {
        // Normal Text Chat
        messages.push({ role: "user", content: userMessage });
    }

    // Pollinations ChatGPT-4o Call
    const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: messages,
            model: 'openai', // This is ChatGPT-4o with Vision
            seed: Math.floor(Math.random() * 1000)
        })
    });

    if (!response.ok) throw new Error("Pollinations Service Down");
    const aiText = await response.text();

    return res.status(200).json({ 
        text: aiText || "I couldn't read the paper. Please try again.", 
        audio: null 
    });

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: "Server Error", text: "Something went wrong at the backend." });
  }
      }
