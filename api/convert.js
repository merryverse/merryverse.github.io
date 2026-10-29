
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  const apiKey = (process.env.GEMINI_API_KEY || "").trim();

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY পাওয়া যায়নি। Vercel Environment Variables পরীক্ষা করুন।"
    });
  }

  const { mimeType, base64Data } = req.body || {};

  if (
    typeof mimeType !== "string" ||
    typeof base64Data !== "string" ||
    !base64Data
  ) {
    return res.status(400).json({
      error: "mimeType অথবা base64Data পাওয়া যায়নি।"
    });
  }

  const promptText = `
Extract all text, data, and tables from this document accurately.
Preserve the original reading order, headings, paragraphs and tables.
Convert tables into valid HTML table tags with borders.
Use appropriate HTML tags for headings and paragraphs.
Return only raw HTML, without Markdown code fences.
Do not invent missing or unreadable content.
`;

  async function generate(model) {
    const apiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${model}:generateContent`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(
        data?.error?.message || "Gemini API request failed"
      );

      error.status = response.status;
      error.apiStatus = data?.error?.status;
      error.model = model;
      throw error;
    }

    const candidate = data?.candidates?.[0];
    const html = candidate?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!html) {
      const reason = candidate?.finishReason ||
        data?.promptFeedback?.blockReason ||
        "No text returned";

      const error = new Error(
        `Gemini থেকে HTML পাওয়া যায়নি: ${reason}`
      );
      error.status = 502;
      throw error;
    }

    return html
      .replace(/```html/gi, "")
      .replace(/```/g, "")
      .trim();
  }

  try {
    let html;
    let usedModel = "gemini-4-argon";

    try {
      html = await generate(usedModel);
    } catch (err) {
      // Only switch models for temporary service overload.
      if (err.status !== 503) {
        throw err;
      }

      usedModel = "gemini-3.8-flash";
      html = await generate(usedModel);
    }

    return res.status(200).json({
      html,
      model: usedModel
    });

  } catch (err) {
    console.error("Gemini conversion error:", {
      status: err.status,
      apiStatus: err.apiStatus,
      model: err.model,
      message: err.message
    });

    const status = [400, 401, 403, 404, 429, 503]
      .includes(err.status)
      ? err.status
      : 502;

    let message = err.message;

    if (err.status === 429) {
      message =
        "Gemini API quota/rate limit exceeded. " +
        "AI Studio-তে এই মডেলের usage ও rate limits পরীক্ষা করুন।";
    } else if (err.status === 503) {
      message =
        "Gemini সার্ভার বর্তমানে ব্যস্ত। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    }

    return res.status(status).json({
      error: message,
      apiStatus: err.apiStatus || null,
      model: err.model || null
    });
  }
};
