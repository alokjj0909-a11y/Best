// api/gemini.js - ULTIMATE FIXED VERSION

export default async function handler(req, res) {
  // ✅ सही CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

  // ✅ OPTIONS request handle करो
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // ✅ सिर्फ POST allow करो
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

      // ✅ SiliconFlow FREE Models
      const models = [
        'Qwen/Qwen2.5-7B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct'
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
                { role: 'system', content: systemInstruction || "You are PadhaiSetu, a helpful assistant." },
                { role: 'user', content: userMessage }
              ],
              temperature: 0.7,
              max_tokens: 1000
            })
          });

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
          continue;
        }
      }

      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: "माफ कीजिए, सेवा में समस्या है। 🙏" }]
          }
        }]
      });
    }

    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "नमस्ते! मैं PadhaiSetu हूँ।" }]
        }
      }]
    });

  } catch (error) {
    return res.status(200).json({
      candidates: [{
        content: {
          parts: [{ text: "माफ कीजिए, कुछ गड़बड़ हुई। 🙏" }]
        }
      }]
    });
  }
    }
