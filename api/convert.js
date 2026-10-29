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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
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
