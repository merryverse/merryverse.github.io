module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { mode, text, targetLang } = req.body;
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(400).json({ error: "API Key পাওয়া যাচ্ছে না।" });
    }
    if (!text) {
      return res.status(400).json({ error: "No text provided." });
    }

    let promptText = "";
    if (mode === "translate") {
      promptText = `Translate the following text accurately into ${targetLang}. Maintain natural flow, proper grammar, and context. Return strictly the translated text without markdown wrappers or quotes:\n\n${text}`;
    } else if (mode === "dictionary") {
      promptText = `Act as an expert dictionary. Provide detailed information for the word/phrase "${text}" in the following HTML format strictly without any markdown code blocks (like \`\`\`html):\n\n<div class='dict-word'>${text}</div>\n<div class='dict-item'><span class='dict-label'>Pronunciation:</span> [IPA or Phonetic]</div>\n<div class='dict-item'><span class='dict-label'>Part of Speech:</span> [Noun/Verb/Adjective etc.]</div>\n<div class='dict-item'><span class='dict-label'>Bangla Meaning (বাংলা অর্থ):</span> [Meaning in Bangla]</div>\n<div class='dict-item'><span class='dict-label'>Synonyms (সমার্থক শব্দ):</span> [2-3 words]</div>\n<div class='dict-item'><span class='dict-label'>Example:</span> [An English sentence] <br><span style='color:#666; font-size:13px;'>[Bangla translation of the sentence]</span></div>`;
    } else {
      return res.status(400).json({ error: "Invalid mode." });
    }

    const baseHost = "https://" + "generativelanguage.googleapis.com/v1beta/models";
    
    // Fallback models optimized for fast text tasks
    const modelsToTry = [
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.0-flash",
      "gemini-2.0-flash"
    ];

    let lastError = "সার্ভার ব্যস্ত, কিছুক্ষণ পর চেষ্টা করুন।";

    for (const model of modelsToTry) {
      const apiUrl = baseHost + "/" + model + ":generateContent?key=" + apiKey;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: promptText }]
          }]
        })
      });

      const data = await response.json();

      if (!data.error && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let aiResult = data.candidates[0].content.parts[0].text;
        // Clean up markdown if AI includes it by mistake
        aiResult = aiResult.replace(/```html/gi, '').replace(/```/g, '').trim();
        return res.status(200).json({ result: aiResult });
      }

      if (data.error) {
        const msg = data.error.message.toLowerCase();
        if (msg.includes("api key not valid") || msg.includes("key expired")) {
          return res.status(400).json({ error: data.error.message });
        }
        if (!msg.includes("not found") && !msg.includes("no longer available")) {
          lastError = "[" + model + "] " + data.error.message;
        }
      }
    }

    return res.status(400).json({ error: lastError });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
