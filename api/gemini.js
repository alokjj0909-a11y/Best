// api/gemini.js - SiliconFlow + Hugging Face (Bonus Balance Friendly)

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

    // ---------- MODE: TEXT / CHAT ----------
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

      if (!process.env.SILICONFLOW_KEY) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Server configuration error: SiliconFlow key missing." }]
            }
          }]
        });
      }

      // ✅ BONUS BALANCE FRIENDLY MODELS
      // Try models that work with bonus balance
      const models = [
        'Qwen/Qwen2.5-7B-Instruct',           // ✅ Works with bonus
        'deepseek-ai/DeepSeek-V2.5-7B',       // ✅ Works with bonus
        'THUDM/glm-4-9b-chat',                 // ✅ Works with bonus
        'microsoft/Phi-3.5-mini-instruct'      // ✅ Works with bonus
      ];

      let lastError = null;
      
      for (const model of models) {
        try {
          const response = await fetch(SILICONFLOW_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: systemInstruction || "You are PadhaiSetu, a helpful educational assistant for Indian students. Respond in the same language as the user's query (Hindi, English, Gujarati, etc.)."
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
            console.error(`❌ SiliconFlow error (${model}):`, response.status, errorText);
            lastError = { status: response.status, text: errorText };
            continue; // Try next model
          }

          const data = await response.json();
          const aiResponse = data.choices[0].message.content;

          // ✅ SUCCESS
          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: aiResponse }]
              }
            }]
          });
        } catch (modelError) {
          console.error(`Model ${model} failed:`, modelError);
          lastError = modelError;
          continue;
        }
      }

      // All models failed
      console.error('All SiliconFlow models failed:', lastError);
      
      // Friendly error message
      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: "माफ कीजिए, AI सेवा में समस्या है। कृपया थोड़ी देर में प्रयास करें। 🙏" }]
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
      
      try {
        const response = await fetch(SILICONFLOW_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen2.5-7B-Instruct', // ✅ Bonus balance friendly
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

        if (!response.ok) {
          return res.status(200).json({ text: "New Chat" });
        }

        const data = await response.json();
        const title = data.choices[0].message.content.replace(/["']/g, '').trim();
        return res.status(200).json({ text: title });
      } catch (error) {
        return res.status(200).json({ text: "New Chat" });
      }
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
