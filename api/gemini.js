// api/gemini.js - SILICONFLOW ONLY (Using FREE Models)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "Method not allowed." }]
        }
      }]
    });
  }

  try {
    const payload = req.body;
    const { mode, contents, systemInstruction } = payload;

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

      // ✅ FREE MODELS (Bonus Balance की जरूरत नहीं)
      const models = [
        'Qwen/Qwen2.5-7B-Instruct',     // ✅ Always FREE
        'meta-llama/Meta-Llama-3.1-8B-Instruct', // ✅ Always FREE
        'THUDM/glm-4-9b-chat'            // ✅ FREE
      ];

      for (const model of models) {
        try {
          const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.SILICONFLOW_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemInstruction || "You are PadhaiSetu, a helpful educational assistant." },
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7,
              max_tokens: 2000  // ⚡ कम कर दिया timeout के लिए
            })
          }, 8000); // ⏱️ 8 second timeout

          if (!response.ok) continue;

          const data = await response.json();
          const aiResponse = data.choices[0].message.content;

          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: aiResponse }]
              }
            }]
          });
        } catch (e) {
          console.log(`Model ${model} failed:`, e.message);
          continue;
        }
      }

      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: "Service unavailable. Please try again." }]
          }
        }]
      });
    }

    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "Namaste!" }]
        }
      }]
    });

  } catch (error) {
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "Error occurred. Please try again." }]
        }
      }]
    });
  }
      }
