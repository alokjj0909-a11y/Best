// api/gemini.js - GROQ + Hugging Face (FINAL WORKING VERSION)

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const HF_API_URL = 'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev';

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

    // ---------- MODE 1: TEXT / CHAT (Groq) ----------
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

      // Try multiple models if one fails
      const models = [
        'llama-3.3-70b-versatile',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
      ];

      let lastError = null;
      
      for (const model of models) {
        try {
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
              max_tokens: 4096
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Groq error (${model}):`, response.status, errorText);
            lastError = { status: response.status, text: errorText };
            continue; // Try next model
          }

          const data = await response.json();
          const aiResponse = data.choices[0].message.content;

          // ✅ SUCCESS - Return in Gemini format
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
      console.error('All Groq models failed:', lastError);
      
      // Rate limit error
      if (lastError?.status === 429) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "⏳ Groq is busy right now. Please wait a moment and try again. (Rate limit: 30 requests/minute)" }]
            }
          }]
        });
      }

      // Generic error
      return res.status(200).json({
        candidates: [{
          content: {
            parts: [{ text: "माफ कीजिए, AI सेवा में समस्या है। कृपया थोड़ी देर में प्रयास करें। 🙏" }]
          }
        }]
      });
    }

    // ---------- MODE 2: REASONING (DeepSeek via Groq) ----------
    else if (mode === 'reasoning') {
      const userMessage = contents?.[0]?.parts?.[0]?.text || '';
      
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'deepseek-r1-distill-llama-70b',
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
            max_tokens: 8192
          })
        });

        if (!response.ok) {
          // Fallback to regular chat model
          const fallbackResponse = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: userMessage }],
              temperature: 0.7,
              max_tokens: 4096
            })
          });

          const fallbackData = await fallbackResponse.json();
          const fallbackText = fallbackData.choices[0].message.content;

          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: fallbackText }]
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
      } catch (error) {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Reasoning service unavailable. Please try again." }]
            }
          }]
        });
      }
    }

    // ---------- MODE 3: TITLE GENERATION (Fast model) ----------
    else if (mode === 'title') {
      const text = contents?.[0]?.parts?.[0]?.text || "chat";
      
      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
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

    // ---------- MODE 4: VISION (via Groq) ----------
    else if (mode === 'vision') {
      const hasImage = contents?.[0]?.parts?.some(part => part.image);
      
      if (hasImage) {
        const imageData = contents[0].parts.find(part => part.image)?.image;
        const textQuery = contents[0].parts.find(part => part.text)?.text || "What is shown in this educational diagram?";
        
        try {
          const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'llama-4-scout-17b-16e-instruct',
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
        } catch (error) {
          return res.status(200).json({
            candidates: [{
              content: {
                parts: [{ text: "Vision processing failed. Please try again." }]
              }
            }]
          });
        }
      } else {
        return res.status(200).json({
          candidates: [{
            content: {
              parts: [{ text: "Please provide an image for vision analysis." }]
            }
          }]
        });
      }
    }

    // ---------- MODE 5: IMAGE GENERATION (Hugging Face) ----------
    else if (mode === 'image') {
      const imagePrompt = prompt || "educational diagram";
      
      try {
        const response = await fetch(HF_API_URL, {
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

    // ---------- MODE 6: TTS (Browser fallback) ----------
    else if (mode === 'tts') {
      // Browser TTS will handle this
      return res.status(200).json({ useBrowserTTS: true });
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
