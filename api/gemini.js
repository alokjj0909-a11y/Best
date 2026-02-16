// api/gemini.js - FINAL WORKING VERSION
// SiliconFlow Official API - FREE Models

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // ✅ Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ✅ Only allow POST
  if (req.method !== 'POST') {
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "Please use POST method." }]
        }
      }]
    });
  }

  try {
    const { mode, contents, systemInstruction } = req.body;

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

      // ✅ Check if API key exists
      if (!process.env.SILICONFLOW_KEY) {
        console.error('❌ SILICONFLOW_KEY not found in environment');
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Server configuration error. Please contact admin." }]
            }
          }]
        });
      }

      // ✅ FREE Models that work with your account
      const models = [
        'Qwen/Qwen2.5-7B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct',
        'THUDM/glm-4-9b-chat'
      ];

      for (const model of models) {
        try {
          console.log(`🔄 Trying model: ${model}`);
          
          const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
              // ✅ .trim() removes any accidental spaces
              'Authorization': `Bearer ${process.env.SILICONFLOW_KEY?.trim()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              messages: [
                {
                  role: 'system',
                  content: systemInstruction || "You are PadhaiSetu, a helpful educational assistant. Respond in Hindi, English, or Gujarati as per user's language."
                },
                {
                  role: 'user',
                  content: userMessage
                }
              ],
              temperature: 0.7,
              max_tokens: 1000 // Faster response for Vercel timeout
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ Model ${model} failed:`, response.status, errorText);
            continue;
          }

          const data = await response.json();
          const aiResponse = data.choices[0]?.message?.content;

          if (!aiResponse) {
            console.log('❌ No content in response');
            continue;
          }

          console.log(`✅ Model ${model} succeeded`);
          
          // ✅ Return in Gemini format
          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: aiResponse }]
              }
            }]
          });

        } catch (error) {
          console.log(`❌ Model ${model} error:`, error.message);
          continue;
        }
      }

      // All models failed
      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: "सेवा उपलब्ध नहीं है। कृपया बाद में प्रयास करें। 🙏" }]
          }
        }]
      });
    }

    // ---------- MODE: TITLE GENERATION ----------
    else if (mode === 'title') {
      const text = contents?.[0]?.parts?.[0]?.text || "chat";
      
      try {
        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SILICONFLOW_KEY?.trim()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'Qwen/Qwen2.5-7B-Instruct',
            messages: [{
              role: 'user',
              content: `Generate a very short title (max 4 words) for this conversation: "${text}"`
            }],
            temperature: 0.3,
            max_tokens: 30
          })
        });

        if (!response.ok) {
          return res.status(200).json({ text: "New Chat" });
        }

        const data = await response.json();
        const title = data.choices[0]?.message?.content?.replace(/["']/g, '').trim() || "New Chat";
        return res.status(200).json({ text: title });
      } catch (error) {
        return res.status(200).json({ text: "New Chat" });
      }
    }

    // ---------- DEFAULT FALLBACK ----------
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "नमस्ते! मैं PadhaiSetu हूँ।" }]
        }
      }]
    });

  } catch (error) {
    console.error('🔥 Server error:', error);
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "कोई त्रुटि हुई। कृपया पुनः प्रयास करें। 🙏" }]
        }
      }]
    });
  }
          }
