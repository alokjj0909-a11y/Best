// api/gemini.js - SiliconFlow + Hugging Face (100% FREE, Higher Limits)

const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "Method not allowed. Please use POST." }]
        }
      }]
    });
  }

  try {
    const payload = req.body;
    const { mode, contents, prompt, systemInstruction } = payload;

    // ---------- MODE: TEXT / CHAT (SiliconFlow) ----------
    if (mode === 'text') {
      const userMessage = contents?.[0]?.parts?.[0]?.text || '';
      
      if (!userMessage) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Please provide a message." }]
            }
          }]
        });
      }

      // Check if SILICONFLOW_KEY exists
      if (!process.env.SILICONFLOW_KEY) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Server configuration error: SiliconFlow key missing." }]
            }
          }]
        });
      }

      const response = await fetch(SILICONFLOW_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
          messages: [
            {
              role: 'system',
              content: systemInstruction || "You are PadhaiSetu, a helpful educational assistant for Indian students. Respond in the same language as the user's query."
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 4096
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ SiliconFlow error:', response.status, errorText);
        
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "माफ कीजिए, AI सेवा में समस्या है। कृपया थोड़ी देर में प्रयास करें। 🙏" }]
            }
          }]
        });
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;

      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: aiResponse }]
          }
        }]
      });
    }

    // ---------- MODE: IMAGE GENERATION (Hugging Face) ----------
    else if (mode === 'image') {
      const imagePrompt = prompt || "educational diagram";
      
      if (!process.env.HF_TOKEN) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Image generation not configured." }]
            }
          }]
        });
      }

      try {
        const response = await fetch('https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HF_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inputs: imagePrompt })
        });

        if (!response.ok) {
          if (response.status === 503) {
            return res.status(200).json({
              candidates: [{
                content: {
                  parts: [{ text: "⏳ Image model is loading. Please try again in 20 seconds." }]
                }
              }]
            });
          }
          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: "Image generation failed. Please try again." }]
              }
            }]
          });
        }

        const imageBuffer = await response.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');

        return res.status(200).json({
          predictions: [{
            bytesBase64Encoded: base64Image
          }]
        });
      } catch (error) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Image generation service unavailable." }]
            }
          }]
        });
      }
    }

    // ---------- MODE: TITLE GENERATION ----------
    else if (mode === 'title') {
      const text = contents?.[0]?.parts?.[0]?.text || "chat";
      
      const response = await fetch(SILICONFLOW_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
          messages: [
            {
              role: 'user',
              content: `Generate a very short title (max 4 words) for this conversation: "${text}"`
            }
          ],
          temperature: 0.3,
          max_tokens: 30
        })
      });

      const data = await response.json();
      const title = data.choices[0].message.content.replace(/["']/g, '').trim();
      return res.status(200).json({ text: title });
    }

    // ---------- DEFAULT FALLBACK ----------
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "Namaste! Main PadhaiSetu hoon. Aapki kya madad kar sakta hoon?" }]
        }
      }]
    });

  } catch (error) {
    console.error('🔥 Function error:', error);
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "माफ कीजिए, कुछ तकनीकी दिक्कत है। कृपया थोड़ी देर में फिर से कोशिश करें। 🙏" }]
        }
      }]
    });
  }
              }
