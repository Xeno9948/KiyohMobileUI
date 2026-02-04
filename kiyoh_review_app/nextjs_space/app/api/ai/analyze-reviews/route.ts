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

    // Fetch recent reviews from Kiyoh
    const { locationId, apiToken, tenantId, baseUrl } = user.company;
    const reviewsUrl = `${baseUrl}/v1/publication/review/external?locationId=${locationId}&tenantId=${tenantId}&limit=20`;

    const response = await fetch(reviewsUrl, {
      headers: {
        "X-Publication-Api-Token": apiToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    const data = await response.json();
    const reviews = data?.reviews || [];

    if (reviews.length === 0) {
      return NextResponse.json({ strongPoints: [] });
    }

    // Extract review texts
    const reviewTexts = reviews
      .map((r: any) => {
        const positive = r.reviewContent?.find((c: any) => c.questionGroup === "positive")?.rating;
        const general = r.reviewContent?.find((c: any) => c.questionGroup === "general_opinion")?.rating;
        return positive || general || "";
      })
      .filter((t: string) => t && t.length > 5)
      .slice(0, 15);

    if (reviewTexts.length === 0) {
      return NextResponse.json({ strongPoints: [] });
    }

    // Fetch Global System Settings
    const settings = await prisma.systemSettings.findUnique({ where: { id: "global" } });
    const aiProvider = settings?.aiProvider || "openai";
    const aiApiKey = settings?.aiApiKey || process.env.ABACUSAI_API_KEY; // Fallback for backwards compatibility if needed
    const aiModel = settings?.aiModel || "gpt-4-turbo";

    if (!aiApiKey) {
      console.error("No AI API Key found in settings or env");
      return NextResponse.json({ error: "AI configuration missing" }, { status: 500 });
    }

    let llmResponse: Response;
    const systemPrompt = `Je bent een expert in het analyseren van klantreviews. Analyseer de volgende reviews en identificeer de 3 belangrijkste sterke punten van dit bedrijf. Geef korte, bondige punten in het Nederlands (max 3-4 woorden per punt). Geef alleen de punten als JSON array van strings, zonder extra uitleg.`;
    const userPrompt = `Reviews:\n${reviewTexts.join("\n\n")}`;

    if (aiProvider === "anthropic") {
      // Anthropic API calls
      llmResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': aiApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: aiModel || "claude-3-opus-20240229",
          max_tokens: 500,
          messages: [
            { role: "user", content: `${systemPrompt}\n\n${userPrompt}` } // Claude system prompts are separate usually, but this works for simple cases
          ]
        })
      });
    } else if (aiProvider === "abacus") {
      // Abacus API calls (Legacy support matches user env)
      llmResponse = await fetch('https://medici-holding.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini', // Abacus might map this specifically
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
    } else {
      // Default: OpenAI (works for most OpenAI-compatible endpoints)
      llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
    }

    if (!llmResponse.ok) {
      console.error('LLM API error:', await llmResponse.text());
      return NextResponse.json({ error: "AI analysis failed" }, { status: 500 });
    }

    const llmData = await llmResponse.json();
    let content = "";

    if (aiProvider === "anthropic") {
      content = llmData.content[0]?.text || "[]";
    } else {
      // OpenAI / Abacus style response
      content = llmData.choices?.[0]?.message?.content || "[]";
    }

    let strongPoints: string[] = [];
    try {
      strongPoints = JSON.parse(content.replace(/```json?\n?|```/g, "").trim());
    } catch {
      strongPoints = ["Goede service", "Betrouwbaar", "Snelle levering"];
    }

    // Cache strong points in database
    await prisma.company.update({
      where: { id: user.company.id },
      data: { strongPoints: JSON.stringify(strongPoints) },
    });

    return NextResponse.json({ strongPoints });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    // Return cached strong points
    const strongPoints = user.company.strongPoints
      ? JSON.parse(user.company.strongPoints)
      : null;

    return NextResponse.json({ strongPoints });
  } catch (error) {
    console.error("Get strong points error:", error);
    return NextResponse.json({ error: "Failed to get strong points" }, { status: 500 });
  }
}
