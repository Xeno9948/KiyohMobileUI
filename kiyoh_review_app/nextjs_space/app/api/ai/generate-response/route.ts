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

    // Fetch user and system settings
    const [user, settings] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email! },
        include: { company: true },
      }),
      prisma.systemSettings.findUnique({ where: { id: "global" } })
    ]);

    if (!user?.company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyName = user.company.name;

    const aiProvider = settings?.aiProvider || "openai";
    const aiApiKey = settings?.aiApiKey || process.env.OPENAI_API_KEY;
    const aiModel = settings?.aiModel || "gpt-3.5-turbo";

    console.log(`Generating AI response using provider: ${aiProvider}`);

    const systemPrompt = `You are a customer service agent for ${companyName}.
Your task is to write a professional, friendly response to a customer review.
IMPORTANT: Detect the language of the review and write your response IN THE SAME LANGUAGE.

Guidelines:
- Keep it short and personal (2-4 sentences).
- Start with the customer's name if known.
- If positive (${rating}/10): Thank them warmly.
- If neutral (${rating}/10): Thank them for feedback and offer improvement.
- If negative (${rating}/10): Show empathy, apologize, and suggest a solution.
- End with a welcoming closing.
- Use "we" (first person plural).`;

    const userPrompt = `Customer: ${reviewAuthor || "Anonymous"}\nRating: ${rating}/10\nReview: "${reviewText}"`;

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
