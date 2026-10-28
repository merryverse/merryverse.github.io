export default async function handler(req, res) {
  // CORS পারমিশন দেওয়ার জন্য
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
    const apiKey = process.env.GEMINI_API_KEY; // Vercel-এর সিক্রেট কি থেকে এটি অটোমেটিক নিয়ে নেবে

    const promptText = "Extract all text, data, and tables from this document accurately. Convert any tables into valid HTML <table> tags with borders. Format regular text with <p> tags. Maintain the original structure. Return strictly the raw HTML code without any markdown blocks like ```html.";

    const response = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){apiKey}`, {
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
}
