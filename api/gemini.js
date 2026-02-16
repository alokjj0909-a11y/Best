// api/gemini.js - GOOGLE STUDIO VERSION
export default async function handler(req, res) {
  // 1. CORS Headers (Security)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  // 2. API Key Check (Vercel Environment Variable)
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) return res.status(500).json({ error: "Server Error: API Key Missing" });

  const { mode, contents, prompt } = req.body;

  try {
    // ==========================================
    // 🎨 MODE: IMAGE GENERATION (Imagen 3)
    // ==========================================
    if (mode === 'image') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instances: [{ prompt: prompt || "Educational diagram" }],
            parameters: { sampleCount: 1, aspectRatio: "1:1" }
        })
      });

      const data = await response.json();
      
      // Error Check
      if (data.error) throw new Error(data.error.message);

      if (data.predictions?.[0]?.bytesBase64Encoded) {
        return res.status(200).json({ image: data.predictions[0].bytesBase64Encoded });
      } else {
        throw new Error("Image generation failed");
      }
    }

    // ==========================================
    // 🎤 MODE: TTS (Audio via Gemini 2.0)
    // ==========================================
    else if (mode === 'tts') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const textToSpeak = contents?.[0]?.parts?.[0]?.text || "Hello";

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: "Read this naturally: " + textToSpeak }] }],
            generationConfig: {
                responseModalities: ["AUDIO"], // Audio maang rahe hain
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
            }
        })
      });

      const data = await response.json();
      
      // Error Check
      if (data.error) {
          // Agar Audio fail ho jaye, to error bhejo taki browser khud bol le
          return res.status(400).json({ error: "TTS Fallback" });
      }

      const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (audioData) {
        return res.status(200).json({ audio: audioData });
      } else {
        return res.status(400).json({ error: "No audio data" });
      }
    }

    // ==========================================
    // 💬 MODE: TEXT & VISION (Gemini 2.0 Flash)
    // ==========================================
    else {
      // Sabse fast aur smart model (Chat + Images samajhne ke liye)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: contents,
            systemInstruction: req.body.systemInstruction, // Persona set karne ke liye
            generationConfig: { temperature: 0.7 }
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        return res.status(200).json({ text: text });
      } else {
        throw new Error("No text response");
      }
    }

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: "PadhaiSetu Error: " + error.message });
  }
}
