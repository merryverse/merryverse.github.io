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
    const { mimeType, base64Data } = req.body;
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();

    if (!apiKey) {
      return res.status(400).json({ error: "API Key পাওয়া যাচ্ছে না।" });
    }

    const baseHost = "https://" + "generativelanguage.googleapis.com/v1beta/models";

    const listRes = await fetch(baseHost + "?key=" + apiKey);
    const listData = await listRes.json();

    let availableModels = [];
    if (listData.models) {
      availableModels = listData.models
        .filter(m => 
          m.supportedGenerationMethods && 
          m.supportedGenerationMethods.includes("generateContent") &&
          !m.name.includes("3.8") &&
          !m.name.includes("argon") &&
          !m.name.includes("pro") &&
          !m.name.includes("ultra")
        )
        .map(m => m.name.replace("models/", ""));
    }

    const priorityList = [
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.0-flash-lite",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.0-flash",
      "gemini-2.0-flash"
    ];

    const modelsToTry = [...new Set([...priorityList, ...availableModels])].filter(m => !m.includes("3.8"));

    const promptText = "Extract all text, data, and tables from this document accurately. Convert any tables into valid HTML <table> tags with borders. Format regular text with <p> tags. Maintain the original structure. Return strictly the raw HTML code without any markdown blocks like ```html.";

    let lastError = "সার্ভার ব্যস্ত, কিছুক্ষণ পর চেষ্টা করুন।";

    for (const model of modelsToTry) {
      const apiUrl = baseHost + "/" + model + ":generateContent?key=" + apiKey;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }]
        })
      });

      const data = await response.json();

      if (!data.error && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        let htmlResult = data.candidates[0].content.parts[0].text;
        htmlResult = htmlResult.replace(/```html/gi, '').replace(/```/g, '').trim();
        return res.status(200).json({ html: htmlResult });
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
