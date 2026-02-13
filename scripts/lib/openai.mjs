const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateStructuredJson({ systemPrompt, userPrompt }) {
  if (!hasOpenAiKey()) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const response = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const failureText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${failureText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("OpenAI response missing content");
  }

  return JSON.parse(content);
}
