// api/gemini.js - GROQ API Version
// FREE + POWERFUL models from Groq Cloud

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
    console.log('📥 Received:', JSON.stringify(payload).substring(0, 200));

    const { mode, contents, prompt, systemInstruction } = payload;

    // ---------- MODE 1: TEXT / CHAT (Groq - FREE Models) ----------
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

      // 🚀 GROQ FREE MODELS (High Rate Limits)
      const model = 'llama-3.3-70b-versatile'; // Best for education
      // Alternatives (all FREE on Groq):
      // - 'mixtral-8x7b-32768' (32768 context)
      // - 'gemma2-9b-it' (Google's model)
      // - 'llama-3.1-8b-instant' (8B, very fast)

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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
          max_tokens: 4096, // Groq allows large outputs
          top_p: 0.9
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq error:', response.status, errorText);
        
        // Check rate limits
        if (response.status === 429) {
          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: "⏳ Rate limit reached. Please wait a moment and try again. Groq free tier gives 30 requests/minute." }]
              }
            }]
          });
        }
        
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

      // Return in Gemini format
      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: aiResponse }]
          }
        }]
      });
    }

    // ---------- MODE 2: REASONING / COMPLEX TASKS (DeepSeek via Groq) ----------
    else if (mode === 'reasoning') {
      const userMessage = contents?.[0]?.parts?.[0]?.text || '';
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-r1-distill-llama-70b', // Specialized reasoning model
          messages: [
            {
              role: 'system',
              content: 'You are an expert teacher. Provide step-by-step reasoning for complex problems. Think carefully before answering.'
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.6,
          max_tokens: 8192 // Very large output for complex reasoning
        })
      });

      if (!response.ok) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Reasoning service busy. Using standard model instead." }]
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

    // ---------- MODE 3: TITLE GENERATION (Fast model) ----------
    else if (mode === 'title') {
      const text = contents?.[0]?.parts?.[0]?.text || "chat";
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant', // Fastest model
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

    // ---------- MODE 4: VISION (Llama 4 Scout via Groq) ----------
    else if (mode === 'vision') {
      const hasImage = contents?.[0]?.parts?.some(part => part.image);
      
      if (hasImage) {
        // Groq's Llama 4 Scout supports vision
        const imageData = contents[0].parts.find(part => part.image)?.image;
        const textQuery = contents[0].parts.find(part => part.text)?.text || "What is shown in this educational diagram?";
        
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-4-scout-17b-16e-instruct', // Vision model
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: { url: imageData }
                  },
                  {
                    type: 'text',
                    text: textQuery
                  }
                ]
              }
            ],
            temperature: 0.7,
            max_tokens: 2048
          })
        });

        if (!response.ok) {
          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: "Vision model unavailable. Please try text-only query." }]
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
      } else {
        // No image, fallback to text
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Please provide an image for vision analysis." }]
            }
          }]
        });
      }
    }

    // ---------- MODE 5: IMAGE GENERATION (Hugging Face - FLUX.1) ----------
    else if (mode === 'image') {
      const imagePrompt = prompt || "educational diagram";
      
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
