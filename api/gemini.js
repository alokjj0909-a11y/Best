// api/gemini.js - STABLE VERSION (1.5 Flash)
export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) return res.status(500).json({ error: "Server Error: API Key Missing" });

  const { mode, contents, prompt } = req.body;

  try {
    // ==========================================
    // 🎨 MODE: IMAGE GENERATION
    // ==========================================
    if (mode === 'image') {
      // Imagen 3.0 try karte hain, agar fail hua to error dega
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
      if (data.predictions?.[0]?.bytesBase64Encoded) {
        return res.status(200).json({ image: data.predictions[0].bytesBase64Encoded });
      } else {
        throw new Error("Image quota exceeded or not enabled.");
      }
    }

    // ==========================================
    // 🎤 MODE: TTS (Audio)
    // ==========================================
    else if (mode === 'tts') {
      // Audio ke liye abhi bhi 2.0 try karte hain, par agar fail ho to browser bolega
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      
      const textToSpeak = contents?.[0]?.parts?.[0]?.text || "Hello";

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: "Read this naturally: " + textToSpeak }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } }
            }
        })
      });

      const data = await response.json();
      // Agar quota error aaye, to frontend ko bolenge browser voice use kare
      if (data.error) {
          return res.status(400).json({ error: "TTS Quota Full" });
      }

      const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (audioData) return res.status(200).json({ audio: audioData });
      
      return res.status(400).json({ error: "No audio" });
    }

    // ==========================================
    // 💬 MODE: TEXT & VISION (CHANGED TO 1.5 FLASH) 🔥
    // ==========================================
    else {
      // YAHAN CHANGE KIYA HAI: 'gemini-2.0-flash' -> 'gemini-1.5-flash'
      // Ye model stable hai aur free tier me hamesha chalta hai.
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: contents,
            systemInstruction: req.body.systemInstruction,
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
    // Error message thoda clean karke bhejenge
    return res.status(500).json({ error: "Quota Issue: Please try again in 1 minute." });
  }
              }
