// api/gemini.js - FIXED VISION HANDLING

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents } = req.body;

    if (mode === 'text') {
      // Check for Groq API Key
      if (!process.env.GROQ_API_KEY) {
        return res.status(200).json({ 
          text: "Server configuration error: API key missing." 
        });
      }

      // Parse contents - बेहतर parsing
      let userText = "";
      let imageUrl = null;
      
      if (contents && contents[0] && contents[0].parts) {
        for (const part of contents[0].parts) {
          if (part.text) {
            userText += part.text + "\n";
          }
          if (part.inlineData) {
            // Clean base64 data
            let base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/jpeg';
            
            // अगर पहले से data URL नहीं है तो बनाओ
            if (!base64Data.startsWith('data:')) {
              imageUrl = `data:${mimeType};base64,${base64Data}`;
            } else {
              imageUrl = base64Data;
            }
            console.log("✅ Image detected in request");
          }
        }
      }

      // Prepare messages
      let messages = [
        { 
          role: "system", 
          content: "You are PadhaiSetu, an expert teacher. You CAN see images. Always solve the question paper completely." 
        }
      ];

      if (imageUrl) {
        // 📸 VISION MODE - Llama 4 Scout
        console.log("🖼️ Using Llama 4 Scout for vision");
        
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userText || "Solve this question paper completely. Use tables." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        });

        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-4-scout-17b-16e-instruct',
            messages: messages,
            temperature: 0.2,
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Groq Vision Error:", errorText);
          return res.status(200).json({ 
            text: "Image processing failed. Please try again with a clearer image." 
          });
        }

        const data = await response.json();
        return res.status(200).json({ text: data.choices[0].message.content });

      } else {
        // 💬 TEXT ONLY MODE
        messages.push({ role: "user", content: userText || "Hello" });

        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        const data = await response.json();
        return res.status(200).json({ text: data.choices[0].message.content });
      }
    }

    // ... (image generation and TTS modes remain same)

  } catch (error) {
    console.error("🔥 Server Error:", error);
    return res.status(500).json({ 
      text: "Server error. Please try again." 
    });
  }
}
