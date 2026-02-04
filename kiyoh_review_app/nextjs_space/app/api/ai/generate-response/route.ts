import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      include: { company: true },
    });

    if (!user?.company) {
      return NextResponse.json({ needsSetup: true }, { status: 400 });
    }

    const { reviewAuthor, rating, reviewText } = await request.json();

    if (!reviewText) {
      return NextResponse.json({ error: "Review text required" }, { status: 400 });
    }

    const isPositive = rating >= 7;
    const isNeutral = rating >= 5 && rating < 7;

    const llmResponse = await fetch('https://medici-holding.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: "system",
            content: `Je bent een klantenservice medewerker voor ${user.company.name}. Schrijf een professionele, vriendelijke reactie op een klantreview in het Nederlands. 

Richtlijnen:
- Houd het kort en persoonlijk (2-4 zinnen)
- Begin met de naam van de klant als deze bekend is
- ${isPositive ? "Bedank de klant hartelijk voor de positieve review" : isNeutral ? "Bedank voor de feedback en bied verbetering aan" : "Toon begrip, bied excuses aan en geef aan hoe je het wilt oplossen"}
- Eindig met een uitnodiging om terug te komen of contact op te nemen
- Geen formele aanhef of afsluiting nodig
- Schrijf in de eerste persoon meervoud (wij)`,
          },
          {
            role: "user",
            content: `Klant: ${reviewAuthor || "Anoniem"}\nBeoordeling: ${rating}/10\nReview: ${reviewText}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!llmResponse.ok) {
      console.error('LLM API error:', await llmResponse.text());
      return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
    }

    const llmData = await llmResponse.json();
    const suggestedResponse = llmData.choices?.[0]?.message?.content || "";

    return NextResponse.json({ suggestedResponse });
  } catch (error) {
    console.error("Generate response error:", error);
    return NextResponse.json({ error: "Failed to generate response" }, { status: 500 });
  }
}
