// api/gemini.js - SILICONFLOW OFFICIAL API

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
    const { mode, contents, systemInstruction } = req.body;

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

      // ✅ SiliconFlow के Official FREE Models
      const models = [
        'Qwen/Qwen2.5-7B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct',
        'THUDM/glm-4-9b-chat'
      ];

      for (const model of models) {
        try {
          // 📌 Official API call जैसा documentation में है
          const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
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
                  content: systemInstruction || "You are PadhaiSetu, a helpful educational assistant for Indian students. Respond in the same language as the user."
                },
                {
                  role: 'user',
                  content: userMessage
                }
              ],
              temperature: 0.7,
              max_tokens: 2000
            })
          });

          if (!response.ok) {
            console.log(`❌ Model ${model} failed:`, response.status);
            continue;
          }

          const data = await response.json();
          
          // ✅ SiliconFlow का response format
          const aiResponse = data.choices[0].message.content;

          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: aiResponse }]
              }
            }]
          });

        } catch (error) {
          console.log(`Model ${model} error:`, error.message);
          continue;
        }
      }

      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: "सेवा उपलब्ध नहीं है। कृपया बाद में प्रयास करें। 🙏" }]
          }
        }]
      });
    }

    // Title generation mode
    else if (mode === 'title') {
      const text = contents?.[0]?.parts?.[0]?.text || "chat";
      
      try {
        const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`,
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
        const title = data.choices[0].message.content.replace(/["']/g, '').trim();
        return res.status(200).json({ text: title });
      } catch (error) {
        return res.status(200).json({ text: "New Chat" });
      }
    }

    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "नमस्ते! मैं PadhaiSetu हूँ।" }]
        }
      }]
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "कोई त्रुटि हुई। कृपया पुनः प्रयास करें। 🙏" }]
        }
      }]
    });
  }
            }
