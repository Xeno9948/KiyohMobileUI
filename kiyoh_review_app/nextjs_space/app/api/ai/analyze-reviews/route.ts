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

    // Fetch user and system settings
    const [user, settings] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email! },
        include: { company: true },
      }),
      prisma.systemSettings.findUnique({ where: { id: "global" } })
    ]);

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
      next: { revalidate: 0 } // No cache
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
    // Look for DEFAULT answers first, then legacy
    const reviewTexts = reviews
      .map((r: any) => {
        const defaultOp = r.reviewContent?.find((c: any) => c.questionGroup === "DEFAULT_OPINION")?.rating;
        const defaultOne = r.reviewContent?.find((c: any) => c.questionGroup === "DEFAULT_ONELINER")?.rating;
        const positive = r.reviewContent?.find((c: any) => c.questionGroup === "positive")?.rating;
        const general = r.reviewContent?.find((c: any) => c.questionGroup === "general_opinion")?.rating;

        return (defaultOp || defaultOne || positive || general || "").toString();
      })
      .filter((t: string) => t && t.length > 5)
      .slice(0, 15);

    if (reviewTexts.length === 0) {
      return NextResponse.json({ strongPoints: [] });
    }

    // Use System Settings for AI
    const aiProvider = settings?.aiProvider || "openai";
    const aiApiKey = settings?.aiApiKey || process.env.OPENAI_API_KEY;
    const aiModel = settings?.aiModel || "gpt-3.5-turbo";

    if (aiProvider !== "abacus" && !aiApiKey) {
      console.error("No AI API Key found");
      return NextResponse.json({ error: "AI configuration missing" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const language = body.language || "Dutch";

    let content = "";
    const systemPrompt = `You are an expert in analyzing customer reviews. Analyze the following reviews and identify the 3 most important strong points of this company.
Provide short, concise points in ${language} (max 3-4 words per point).
OUTPUT FORMAT: Return ONLY a raw JSON array of strings (e.g., ["Point 1", "Point 2", "Point 3"]). Do not include markdown code blocks or extra text.`;
    const userPrompt = `Reviews:\n${reviewTexts.join("\n\n")}`;

    if (aiProvider === "abacus") {
      // Abacus API calls
      const abacusKey = settings?.aiApiKey || process.env.ABACUSAI_API_KEY;
      if (!abacusKey) throw new Error("Missing Abacus Key");

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
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!llmResponse.ok) {
        console.error('Abacus error:', await llmResponse.text());
        throw new Error("Abacus API error");
      }

      const llmData = await llmResponse.json();
      content = llmData.choices?.[0]?.message?.content || "[]";
    } else {
      // OpenAI Default
      const openai = new OpenAI({ apiKey: aiApiKey });
      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        model: aiModel || "gpt-3.5-turbo",
        temperature: 0.3,
        max_tokens: 500,
      });

      content = completion.choices[0]?.message?.content || "[]";
    }

    let strongPoints: string[] = [];
    try {
      // Sanitize response to ensure it's JSON
      const jsonString = content.replace(/```json?\n?|```/g, "").trim();
      const start = jsonString.indexOf('[');
      const end = jsonString.lastIndexOf(']');
      if (start !== -1 && end !== -1) {
        strongPoints = JSON.parse(jsonString.substring(start, end + 1));
      } else {
        // Fallback parsing if not valid JSON array
        throw new Error("Invalid JSON format");
      }
    } catch (e) {
      console.error("Failed to parse strong points:", content);
      // Fallback
      strongPoints = ["Goede service", "Betrouwbaar", "Klantvriendelijk"];
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
