// api/gemini.js - TIMEOUT HANDLING VERSION

export const config = {
  maxDuration: 60,  // Vercel Pro में काम करेगा, Hobby में ignore होगा
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
    const { mode, contents, prompt, systemInstruction } = req.body;

    if (mode === 'text') {
      if (!process.env.GROQ_API_KEY) {
        return res.status(200).json({ text: "Server configuration error." });
      }

      // Parse contents
      let userText = "";
      let imageUrl = null;
      
      if (contents && contents[0] && contents[0].parts) {
        for (const part of contents[0].parts) {
          if (part.text) userText += part.text + "\n";
          if (part.inlineData) {
            let base64Data = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/jpeg';
            
            if (!base64Data.startsWith('data:')) {
              imageUrl = `data:${mimeType};base64,${base64Data}`;
            } else {
              imageUrl = base64Data;
            }
          }
        }
      }

      let messages = [
        { 
          role: "system", 
          content: systemInstruction || "You are PadhaiSetu, an expert teacher. Respond in the same language as the user." 
        }
      ];

      if (imageUrl) {
        // 📸 VISION MODE - with timeout handling
        console.log("🖼️ Trying Llama 4 Scout for vision");
        
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userText || "Solve this question paper completely." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        });

        // Use Promise.race to handle timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Vision timeout")), 9000) // 9 seconds timeout
        );

        const visionPromise = fetch(GROQ_API_URL, {
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
        }).then(async response => {
          if (!response.ok) throw new Error(`Vision failed: ${response.status}`);
          const data = await response.json();
          return data.choices[0].message.content;
        });

        try {
          // Race between vision and timeout
          const visionResponse = await Promise.race([visionPromise, timeoutPromise]);
          return res.status(200).json({ text: visionResponse });
        } catch (error) {
          // Vision timeout or failed - fallback to text-only
          console.log("⚠️ Vision failed, falling back to text-only model");
          
          // Remove image and try with text only
          messages.pop(); // remove vision message
          messages.push({ 
            role: "user", 
            content: userText || "Please help with this question." 
          });

          const textResponse = await fetch(GROQ_API_URL, {
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

          const textData = await textResponse.json();
          return res.status(200).json({ 
            text: textData.choices[0]?.message?.content || "Could not process. Please try again." 
          });
        }

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

    // Image generation and TTS modes (same as before)
    if (mode === 'image') {
      const imagePrompt = encodeURIComponent(prompt || "educational diagram");
      const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
      return res.status(200).json({ image: imageUrl });
    }

    if (mode === 'tts') {
      return res.status(200).json({ audio: null });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("🔥 Server Error:", error);
    return res.status(200).json({ 
      text: "Server busy. Please try again with a clearer image or text only." 
    });
  }
        }
