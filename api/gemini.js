// api/gemini.js
// ULTRA ROBUST CASCADE (405B -> 70B -> 8B)
// Voice: Deepgram | Text: SambaNova
// Gemini COMPLETELY REMOVED from voice

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: { sizeLimit: '4mb' },
  },
};

export default async function handler(req, res) {
  // ================= CORS =================
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { mode, contents, systemInstruction } = req.body;

    const SAMBA_KEY = process.env.SAMBANOVA_KEY;
    const DEEPGRAM_KEY = process.env.DEEPGRAM_API_KEY;

    if (!SAMBA_KEY) {
      return res.status(500).json({ error: 'SAMBANOVA_KEY missing' });
    }

    // =====================================================
    // 🎤 VOICE MODE (Deepgram STT -> SambaNova -> Deepgram TTS)
    // =====================================================
    const hasAudioInput =
      contents?.[0]?.parts?.some(
        p => p.inlineData && p.inlineData.mimeType.startsWith('audio')
      );

    if (mode === 'tts' || (mode === 'text' && hasAudioInput)) {
      if (!DEEPGRAM_KEY) {
        return res.status(500).json({ error: 'DEEPGRAM_API_KEY missing' });
      }

      let userText = '';

      // ---------- STT (Deepgram) ----------
      if (hasAudioInput) {
        const audioPart = contents[0].parts.find(p => p.inlineData);
        const audioBuffer = Buffer.from(audioPart.inlineData.data, 'base64');

        const sttRes = await fetch(
          'https://api.deepgram.com/v1/listen?model=nova-2&language=hi',
          {
            method: 'POST',
            headers: {
              Authorization: `Token ${DEEPGRAM_KEY}`,
              'Content-Type': audioPart.inlineData.mimeType,
            },
            body: audioBuffer,
          }
        );

        if (!sttRes.ok) {
          throw new Error('Deepgram STT failed');
        }

        const sttData = await sttRes.json();
        userText =
          sttData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      } else {
        userText = contents[0].parts[0].text;
      }

      if (!userText) {
        return res.status(200).json({ text: 'Kuch suna nahi 😅' });
      }

      // ---------- SYSTEM PROMPT (UNCHANGED LOGIC) ----------
      let finalSystemPrompt = 'You are a helpful AI tutor.';
      if (systemInstruction?.parts?.[0]?.text) {
        finalSystemPrompt = systemInstruction.parts[0].text;
      }
      finalSystemPrompt +=
        '\n[SYSTEM RULE: Answer clearly, short, Hinglish/Hindi preferred]';

      const messages = [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userText },
      ];

      // ---------- FAST SambaNova (70B for voice) ----------
      const chatRes = await fetch(
        'https://api.sambanova.ai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SAMBA_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'Meta-Llama-3.3-70B-Instruct',
            messages,
            temperature: 0.7,
            max_tokens: 300,
          }),
        }
      );

      if (!chatRes.ok) {
        throw new Error('SambaNova voice reasoning failed');
      }

      const chatData = await chatRes.json();
      const responseText =
        chatData.choices?.[0]?.message?.content || 'Samajh nahi aaya 😅';

      // ---------- TTS (Deepgram) ----------
      const cleanText = responseText.replace(/[*#`]/g, '');

      const ttsRes = await fetch(
        'https://api.deepgram.com/v1/speak?model=aura-asteria-en',
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${DEEPGRAM_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: cleanText }),
        }
      );

      if (!ttsRes.ok) {
        throw new Error('Deepgram TTS failed');
      }

      const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
      const audioBase64 = audioBuffer.toString('base64');

      return res.status(200).json({
        audio: audioBase64,
        text: responseText,
      });
    }

    // =====================================================
    // 🧠 TEXT MODE (SambaNova CASCADE — SAME AS BEFORE)
    // =====================================================
    if (mode === 'text') {
      let finalSystemPrompt = 'You are a helpful AI tutor.';
      if (systemInstruction?.parts?.[0]?.text) {
        finalSystemPrompt = systemInstruction.parts[0].text;
      }
      finalSystemPrompt +=
        '\n[SYSTEM RULE: Use tables for comparison, steps for math]';

      const userMessage = contents[0].parts.map(p => p.text).join('\n');

      const messages = [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userMessage },
      ];

      const callSamba = async (model, timeout) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const r = await fetch(
            'https://api.sambanova.ai/v1/chat/completions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${SAMBA_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model,
                messages,
                temperature: 0.7,
                max_tokens: 1500,
              }),
              signal: controller.signal,
            }
          );
          clearTimeout(id);
          if (!r.ok) throw new Error('fail');
          const d = await r.json();
          return d.choices?.[0]?.message?.content;
        } catch {
          clearTimeout(id);
          throw new Error('timeout');
        }
      };

      try {
        return res.status(200).json({
          text: await callSamba(
            'Meta-Llama-3.1-405B-Instruct',
            6000
          ),
        });
      } catch {
        try {
          return res.status(200).json({
            text: await callSamba(
              'Meta-Llama-3.3-70B-Instruct',
              5000
            ),
          });
        } catch {
          return res.status(200).json({
            text: await callSamba(
              'Meta-Llama-3.1-8B-Instruct',
              3000
            ),
          });
        }
      }
    }

    return res.status(400).json({ error: 'Invalid mode' });
  } catch (err) {
    console.error('Server Error:', err);
    return res.status(500).json({ error: err.message });
  }
        }
