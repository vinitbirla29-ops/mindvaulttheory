"use strict";

// ORIN — Google Gemini Provider
// Runs on a secure Node.js backend, NOT GitHub Pages.

function buildContents(messages) {
  return (Array.isArray(messages) ? messages : [])
    .slice(-12)
    .filter(m =>
      m &&
      typeof m.content === "string" &&
      m.content.trim()
    )
    .map(m => ({
      role: m.role === "assistant" ||
            m.role === "model" ? "model" : "user",
      parts: [{
        text: m.content.slice(0, 8000)
      }]
    }));
}

async function streamGemini({
  messages,
  systemInstruction,
  onText
}) {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const contents = buildContents(messages);

  if (!contents.length) {
    throw new Error("No messages provided");
  }

  const url =
    "https://generativelanguage.googleapis.com" +
    "/v1beta/models/" +
    encodeURIComponent(model) +
    ":streamGenerateContent?alt=sse";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: String(systemInstruction || "")
        }]
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1500
      }
    }),
    signal: AbortSignal.timeout(45000)
  });

  if (!response.ok) {
    throw new Error(
      "Gemini request failed: HTTP " + response.status
    );
  }

  if (!response.body) {
    throw new Error("Gemini returned no response stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  async function processEvent(event) {
    const raw = event
      .split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .join("\n");

    if (!raw || raw === "[DONE]") return;

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const parts =
      data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (typeof part.text === "string" && part.text) {
        await onText(part.text);
      }
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        completed = true;
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";

      for (const event of events) {
        await processEvent(event);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      await processEvent(buffer);
    }
  } finally {
    if (!completed) {
      await reader.cancel().catch(() => {});
    }
    reader.releaseLock();
  }
}

module.exports = {
  streamGemini
};
