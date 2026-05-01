"use server";

import {
  buildFallbackContent,
  buildStylePrompt,
  type ContentMode,
  type GeneratedContent
} from "@/lib/content-platform";

export type CreateContentState = {
  success: boolean;
  error?: string;
  prompt?: string;
  result?: GeneratedContent;
};

async function generateWithOpenAI(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
      input: [
        {
          role: "system",
          content:
            "Geef compacte, bruikbare marketingcontent terug in JSON. Gebruik exact de gevraagde schrijfstijl."
        },
        {
          role: "user",
          content: `${prompt}

Geef alleen geldige JSON terug met deze vorm:
{
  "title": "string",
  "intro": "string",
  "bullets": ["string"],
  "cta": "string",
  "html": "string",
  "meta": {
    "seoTitle": "string",
    "metaDescription": "string",
    "focusKeyword": "string",
    "hook": "string",
    "captionTitle": "string"
  }
}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request mislukt met status ${response.status}.`);
  }

  const data = (await response.json()) as {
    output_text?: string;
  };

  if (!data.output_text) {
    throw new Error("Geen output ontvangen van OpenAI.");
  }

  return JSON.parse(data.output_text) as GeneratedContent;
}

export async function createContentAction(
  _previousState: CreateContentState,
  formData: FormData
): Promise<CreateContentState> {
  const mode = String(formData.get("mode") || "blog") as ContentMode;
  const topic = String(formData.get("topic") || "").trim();

  if (!topic) {
    return {
      success: false,
      error: "Voer eerst een onderwerp in."
    };
  }

  const input = {
    mode,
    topic,
    audience: String(formData.get("audience") || "").trim(),
    goal: String(formData.get("goal") || "").trim(),
    keywords: String(formData.get("keywords") || "").trim(),
    channels: String(formData.get("channels") || "").trim(),
    cta: String(formData.get("cta") || "").trim(),
    extraInstructions: String(formData.get("extraInstructions") || "").trim()
  };

  const prompt = buildStylePrompt(input);

  try {
    const aiResult = await generateWithOpenAI(prompt);

    return {
      success: true,
      prompt,
      result: aiResult ?? buildFallbackContent(input)
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Onbekende fout bij het genereren.";

    return {
      success: true,
      error: `OpenAI was niet beschikbaar, fallback gebruikt. Details: ${message}`,
      prompt,
      result: buildFallbackContent(input)
    };
  }
}
