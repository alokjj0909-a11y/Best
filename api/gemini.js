// api/gemini.js - GROQ VISION with proper image handling

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
    const { mode, contents, prompt, systemInstruction } = req.body;

    if (mode === 'text') {
      if (!process.env.GROQ_API_KEY) {
        return res.status(200).json({ text: "Server configuration error." });
      }

      // Parse contents - बेहतर parsing
      let userText = "";
      let imageBase64 = null;
      let mimeType = "image/jpeg";
      
      if (contents && contents[0] && contents[0].parts) {
        for (const part of contents[0].parts) {
          if (part.text) {
            userText += part.text + "\n";
          }
          if (part.inlineData) {
            console.log("✅ Image detected in request");
            imageBase64 = part.inlineData.data;
            if (part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
          }
        }
      }

      // Prepare messages
      let messages = [
        { 
          role: "system", 
          content: systemInstruction || "You are PadhaiSetu, an expert teacher. You can see images clearly. Always look at the image and answer accurately."
        }
      ];

      if (imageBase64) {
        // 📸 VISION MODE - Llama 4 Scout
        console.log("🖼️ Using Llama 4 Scout for vision");
        
        // Create proper data URL
        const imageUrl = `data:${mimeType};base64,${imageBase64}`;
        
        messages.push({
          role: "user",
          content: [
            { 
              type: "text", 
              text: userText || "This is a question paper. Please look at the image carefully and solve ALL questions. Extract all text from the image." 
            },
            { 
              type: "image_url", 
              image_url: { url: imageUrl } 
            }
          ]
        });

        try {
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
            
            // Try fallback to text-only
            messages.pop();
            messages.push({ 
              role: "user", 
              content: userText || "Please help." 
            });

            const fallbackResponse = await fetch(GROQ_API_URL, {
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

            const fallbackData = await fallbackResponse.json();
            return res.status(200).json({ 
              text: fallbackData.choices[0]?.message?.content || "Could not process." 
            });
          }

          const data = await response.json();
          return res.status(200).json({ text: data.choices[0].message.content });

        } catch (visionError) {
          console.error("🔥 Vision error:", visionError);
          return res.status(200).json({ 
            text: "Image processing error. Please try with a clearer image or type the questions." 
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

    // Image generation mode (unchanged)
    if (mode === 'image') {
      const imagePrompt = encodeURIComponent(prompt || "educational diagram");
      const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
      return res.status(200).json({ image: imageUrl });
    }

    // TTS mode (unchanged)
    if (mode === 'tts') {
      return res.status(200).json({ audio: null });
    }

    return res.status(400).json({ error: 'Invalid mode' });

  } catch (error) {
    console.error("🔥 Server Error:", error);
    return res.status(200).json({ 
      text: "Server error. Please try again." 
    });
  }
                }
