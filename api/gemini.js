// api/gemini.js - ULTIMATE FIXED VERSION
// Groq Vision + Pollinations Flux + Browser TTS

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } },
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { mode, contents, prompt, systemInstruction } = req.body;

    // =================================================================
    // 🎤 MODE: TEXT (Chat, Swadhyay, Smart Class Script)
    // =================================================================
    if (mode === 'text') {
      if (!process.env.GROQ_API_KEY) {
        return res.status(200).json({ text: "Groq API key not configured. Please add GROQ_API_KEY to environment variables." });
      }

      // Parse contents
      let userText = "";
      let imageBase64 = null;
      let mimeType = "image/jpeg";
      
      if (contents && contents[0] && contents[0].parts) {
        for (const part of contents[0].parts) {
          if (part.text) userText += part.text + "\n";
          if (part.inlineData) {
            console.log("✅ Image detected in request");
            imageBase64 = part.inlineData.data;
            if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
          }
        }
      }

      // Prepare messages
      let messages = [
        { 
          role: "system", 
          content: systemInstruction || "You are PadhaiSetu, an expert teacher for Indian students. Respond in Hindi, English, or Gujarati as needed."
        }
      ];

      if (imageBase64) {
        // 📸 VISION MODE - Llama 4 Scout (Correct model ID)
        console.log("🖼️ Using Llama 4 Scout for vision");
        
        // Clean base64 if needed
        if (imageBase64.includes(',')) {
          imageBase64 = imageBase64.split(',')[1];
        }
        
        const imageUrl = `data:${mimeType};base64,${imageBase64}`;
        
        messages.push({
          role: "user",
          content: [
            { type: "text", text: userText || "Solve this question paper completely." },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        });

        try {
          // ✅ FIXED: Correct model ID
          const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct', // ✅ सही ID
              messages: messages,
              temperature: 0.2,
              max_tokens: 4096
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Groq Vision Error:", errorText);
            
            // Rate limit error
            if (response.status === 429) {
              return res.status(200).json({ 
                text: "⏳ Groq is busy. Please wait a moment and try again." 
              });
            }
            
            // Fallback to text-only
            return res.status(200).json({ 
              text: userText || "Please try again with a clearer image." 
            });
          }

          const data = await response.json();
          return res.status(200).json({ text: data.choices[0].message.content });

        } catch (visionError) {
          console.error("🔥 Vision error:", visionError);
          return res.status(200).json({ 
            text: "Image processing error. Please try again." 
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

        if (!response.ok) {
          return res.status(200).json({ text: "Service temporarily unavailable." });
        }

        const data = await response.json();
        return res.status(200).json({ text: data.choices[0].message.content });
      }
    }

    // =================================================================
    // 🎨 MODE: IMAGE GENERATION (Smart Class)
    // =================================================================
    if (mode === 'image') {
      try {
        const imagePrompt = encodeURIComponent(prompt || "educational diagram");
        const seed = Math.floor(Math.random() * 10000);
        const imageUrl = `${POLLINATIONS_IMAGE_URL}/${imagePrompt}?nologo=true&model=flux&width=1024&height=1024&seed=${seed}`;
        
        // Test if image URL is accessible
        const testResponse = await fetch(imageUrl, { method: 'HEAD' });
        
        if (testResponse.ok) {
          return res.status(200).json({ image: imageUrl });
        } else {
          return res.status(200).json({ 
            text: "Image generation service is loading. Please try again in 10 seconds." 
          });
        }
      } catch (imgError) {
        console.error("Image generation error:", imgError);
        return res.status(200).json({ 
          text: "Image generation unavailable. Please try again later." 
        });
      }
    }

    // =================================================================
    // 🎵 MODE: TTS (Browser Fallback)
    // =================================================================
    if (mode === 'tts') {
      // Browser TTS will handle this
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
