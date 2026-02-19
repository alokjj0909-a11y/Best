// api/gemini.js - GROQ VISION + FLUX IMAGE
// Swadhyay Solver के लिए Llama 4 Scout (Vision)
// Chat के लिए Llama 3.3 70B
// Images के लिए Pollinations Flux

export const config = {
  maxDuration: 60,
  api: { bodyParser: { sizeLimit: '10mb' } }, // बड़ी images के लिए
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
    // 🎤 MODE: TEXT (Chat, Swadhyay Solver, Smart Class Script)
    // =================================================================
    if (mode === 'text') {
      // Check for Groq API Key
      if (!process.env.GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY missing');
        return res.status(200).json({ 
          text: "Server configuration error: API key missing." 
        });
      }

      // Parse contents to extract text and image
      let userText = "";
      let imageUrl = null;
      let mimeType = "image/jpeg";

      if (contents && contents[0] && contents[0].parts) {
        for (const part of contents[0].parts) {
          if (part.text) {
            userText += part.text + "\n";
          }
          if (part.inlineData) {
            // Store mime type if available
            if (part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            // Convert base64 to data URL
            imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            console.log("✅ Image detected in request");
          }
        }
      }

      // Prepare system prompt
      const sysContent = systemInstruction?.parts?.[0]?.text || 
                         systemInstruction || 
                         "You are PadhaiSetu, an expert teacher for Indian students. Respond in the same language as the user (Hindi, English, Gujarati, etc.).";

      let messages = [{ role: "system", content: sysContent }];

      // Prepare user message based on whether image exists
      if (imageUrl) {
        // 📸 VISION MODE - Llama 4 Scout (for Swadhyay Solver)
        console.log("🖼️ Using Llama 4 Scout for vision");
        
        messages.push({
          role: "user",
          content: [
            { 
              type: "text", 
              text: userText || "Solve this question paper completely. Use tables where needed. Format answers properly." 
            },
            { 
              type: "image_url", 
              image_url: { url: imageUrl } 
            }
          ]
        });

        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-4-scout-17b-16e-instruct', // Vision model for Swadhyay
            messages: messages,
            temperature: 0.2, // Low temperature for accurate answers
            max_tokens: 4096
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("❌ Groq Vision Error:", response.status, errorText);
          
          // Try fallback to text-only model
          console.log("⚠️ Falling back to text-only model");
          messages = messages.filter(m => m.role !== 'user');
          messages.push({ 
            role: "user", 
            content: userText || "Please help with this question." 
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
            text: fallbackData.choices[0]?.message?.content || "Maafi chahta hoon, samajh nahi paya." 
          });
        }

        const data = await response.json();
        return res.status(200).json({ text: data.choices[0].message.content });

      } else {
        // 💬 TEXT ONLY MODE - Llama 3.3 70B (fast)
        console.log("💬 Using Llama 3.3 70B for text");
        
        messages.push({ 
          role: "user", 
          content: userText || "Hello" 
        });

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
          const errorText = await response.text();
          console.error("❌ Groq Text Error:", response.status, errorText);
          return res.status(200).json({ 
            text: "Service temporarily unavailable. Please try again." 
          });
        }

        const data = await response.json();
        return res.status(200).json({ text: data.choices[0].message.content });
      }
    }

    // =================================================================
    // 🎨 MODE: IMAGE GENERATION (Smart Class Diagrams)
    // =================================================================
    if (mode === 'image') {
      const imagePrompt = encodeURIComponent(prompt || "educational diagram");
      // Pollinations Flux for image generation
      const imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?nologo=true&model=flux&width=1024&height=1024&seed=${Math.floor(Math.random()*1000)}`;
      
      console.log("🖼️ Generating image with Flux");
      return res.status(200).json({ image: imageUrl });
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
    return res.status(500).json({ 
      error: "Server Error", 
      text: "Kuch gadbad ho gayi hai. Please try again." 
    });
  }
            }
