import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { reviewAuthor, rating, reviewText } = await request.json();

    if (!reviewText) {
      return NextResponse.json({ error: "Review text required" }, { status: 400 });
    }

    // Fetch system settings for AI provider
    const settings = await prisma.systemSettings.findUnique({
      where: { id: "global" },
    });

    const aiProvider = settings?.aiProvider || "openai";
    const aiApiKey = settings?.aiApiKey || process.env.OPENAI_API_KEY;
    const aiModel = settings?.aiModel || "gpt-3.5-turbo";

    console.log(`Generating AI response using provider: ${aiProvider}`);

    const isPositive = rating >= 7;
    const isNeutral = rating >= 5 && rating < 7;
    const sentimentPrompt = isPositive
      ? "Bedank de klant hartelijk voor de positieve review"
      : isNeutral
        ? "Bedank voor de feedback en bied verbetering aan"
        : "Toon begrip, bied excuses aan en geef aan hoe je het wilt oplossen";

    const systemPrompt = `Je bent een klantenservice medewerker. Schrijf een professionele, vriendelijke reactie op een klantreview in het Nederlands.
Richtlijnen:
- Houd het kort en persoonlijk (2-4 zinnen)
- Begin met de naam van de klant als deze bekend is
- ${sentimentPrompt}
- Eindig met een uitnodiging om terug te komen of contact op te nemen
- Geen formele aanhef of afsluiting nodig
- Schrijf in de eerste persoon meervoud (wij)`;

    const userPrompt = `Klant: ${reviewAuthor || "Anoniem"}\nBeoordeling: ${rating}/10\nReview: ${reviewText}`;

    let suggestedResponse = "";

    if (aiProvider === "abacus") {
      // Abacus Implementation
      const abacusKey = settings?.aiApiKey || process.env.ABACUSAI_API_KEY;
      if (!abacusKey) throw new Error("Missing Abacus API Key");

      const llmResponse = await fetch('https://medici-holding.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${abacusKey}`,
        },
        body: JSON.stringify({
          model: aiModel || 'gpt-4.1-mini',
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!llmResponse.ok) {
        const errText = await llmResponse.text();
        console.error('Abacus API error:', errText);
        throw new Error(`Abacus API error: ${errText}`);
      }

      const llmData = await llmResponse.json();
      suggestedResponse = llmData.choices?.[0]?.message?.content || "";

    } else {
      // OpenAI Implementation (Default)
      if (!aiApiKey) throw new Error("Missing OpenAI API Key");

      const openai = new OpenAI({ apiKey: aiApiKey });
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model: aiModel || "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 500,
      });

      suggestedResponse = completion.choices[0]?.message?.content || "";
    }

    return NextResponse.json({ suggestedResponse });

  } catch (error: any) {
    console.error("Generate response error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate response" }, { status: 500 });
  }
}
