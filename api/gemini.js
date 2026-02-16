// api/gemini.js - SILICONFLOW ECONOMY EDITION (Best for Low Balance)
// Models: Qwen 2.5 7B (Free/Cheap), Qwen VL 7B (Cheap), FLUX Schnell

export default async function handler(req, res) {
  // 1. CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // 2. API Key Check
  const apiKey = process.env.SILICONFLOW_KEY;
  if (!apiKey) {
      return res.status(500).json({ error: "Server Error: SiliconFlow Key Missing" });
  }

  try {
    const { mode, contents, prompt, systemInstruction } = req.body;

    // ==========================================
    // 🎨 MODE: IMAGE GENERATION
    // ==========================================
    if (mode === 'image') {
      // FLUX.1 Schnell sabse cost-effective hai achi images ke liye
      const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "black-forest-labs/FLUX.1-schnell",
          prompt: prompt || "Educational diagram",
          image_size: "512x512", // Size chota kiya taki credit bache (1024 mehnga hai)
          batch_size: 1,
          num_inference_steps: 4 
        })
      });

      const data = await response.json();
      
      if (data.data?.[0]?.url) {
        return res.status(200).json({ image: data.data[0].url });
      } else {
        throw new Error("Image generation failed");
      }
    }

    // ==========================================
    // 🎤 MODE: TTS (Audio Fallback)
    // ==========================================
    else if (mode === 'tts') {
        return res.status(400).json({ error: "Use Browser TTS" });
    }

    // ==========================================
    // 💬 MODE: TEXT & VISION (Qwen 7B - Economy)
    // ==========================================
    else {
      // 1. HTML se Text aur Image nikalo
      let userText = "";
      let imageUrl = null;
      
      const parts = contents?.[0]?.parts || [];
      parts.forEach(p => {
          if (p.text) userText += p.text + " ";
          if (p.inlineData) imageUrl = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
      });

      // 🔥 COST SAVING CHANGE:
      // Vision ke liye: Qwen2-VL-7B (72B bahut mehnga hai)
      // Text ke liye: Qwen2.5-7B (Ye "Free Tier" jaisa hi hai)
      const model = imageUrl ? "Qwen/Qwen2-VL-7B-Instruct" : "Qwen/Qwen2.5-7B-Instruct";

      // 3. Messages Format
      const messages = [
          {
              role: "system",
              content: systemInstruction?.parts?.[0]?.text || "You are PadhaiSetu, a helpful Indian teacher."
          }
      ];

      if (imageUrl) {
          messages.push({
              role: "user",
              content: [
                  { type: "image_url", image_url: { url: imageUrl } },
                  { type: "text", text: userText || "Analyze this image." }
              ]
          });
      } else {
          messages.push({ role: "user", content: userText || "Hello" });
      }

      // 4. Call SiliconFlow API
      const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 512 // Token limit kam ki taki credits bachein
        })
      });

      const data = await response.json();
      
      // Error handling agar balance khatam ho jaye
      if (data.error) {
          return res.status(200).json({ text: "Error: " + data.error.message });
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        return res.status(200).json({ text: aiText });
      } else {
        throw new Error("No response from AI");
      }
    }

  } catch (error) {
    console.error("Backend Error:", error);
    return res.status(500).json({ error: "PadhaiSetu Error: " + error.message });
  }
          }
          
