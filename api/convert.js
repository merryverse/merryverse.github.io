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

    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();

    if (listData.error) {
      return res.status(400).json({ error: listData.error.message });
    }

    const validModels = (listData.models || []).filter(m => 
      m.supportedGenerationMethods && 
      m.supportedGenerationMethods.includes("generateContent") &&
      m.name.includes("gemini")
    );

    const chosenModel = validModels.find(m => m.name.includes("2.5-flash")) || 
                        validModels.find(m => m.name.includes("2.0-flash")) || 
                        validModels.find(m => m.name.includes("flash")) || 
                        validModels[0];

    if (!chosenModel) {
      return res.status(400).json({ error: "কোনো সচল Gemini মডেল পাওয়া যায়নি।" });
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${chosenModel.name}:generateContent?key=${apiKey}`;
    const promptText = "Extract all text, data, and tables from this document accurately. Convert any tables into valid HTML <table> tags with borders. Format regular text with <p> tags. Maintain the original structure. Return strictly the raw HTML code without any markdown blocks like ```html.";

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

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    let htmlResult = data.candidates[0].content.parts[0].text;
    htmlResult = htmlResult.replace(/```html/gi, '').replace(/```/g, '').trim();

    return res.status(200).json({ html: htmlResult });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
