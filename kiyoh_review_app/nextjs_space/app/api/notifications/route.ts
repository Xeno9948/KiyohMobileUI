import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";

async function generateAIResponse(companyName: string, reviewAuthor: string, rating: number, reviewText: string): Promise<string> {
  if (!reviewText || reviewText.length < 5) return "";

  try {
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
            content: `Je bent een klantenservice medewerker voor ${companyName}. Schrijf een professionele, vriendelijke reactie op een klantreview in het Nederlands. 

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
      return "";
    }

    const llmData = await llmResponse.json();
    return llmData.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("AI generation error:", error);
    return "";
  }
}

// GET - Fetch notifications for user's company
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
      return NextResponse.json({ notifications: [], needsSetup: true });
    }

    const notifications = await prisma.reviewNotification.findMany({
      where: {
        companyId: user.company.id,
        status: { not: "archived" }
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.reviewNotification.count({
      where: {
        companyId: user.company.id,
        isRead: false,
      },
    });

    const pendingCount = await prisma.reviewNotification.count({
      where: {
        companyId: user.company.id,
        status: "pending",
      },
    });

    return NextResponse.json({
      notifications,
      unreadCount,
      pendingCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json({ error: "Failed to get notifications" }, { status: 500 });
  }
}

// POST - Sync new reviews and generate responses
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

    const { locationId, apiToken, tenantId, baseUrl, id: companyId, name: companyName } = user.company;

    // Fetch recent reviews from Kiyoh
    const reviewsUrl = `${baseUrl}/v1/publication/review/external?locationId=${locationId}&tenantId=${tenantId}&limit=10`;

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

    let newCount = 0;

    for (const review of reviews) {
      const reviewId = review.reviewId?.toString();
      if (!reviewId) continue;

      // Robust Extract review content logic (matching reviews-content.tsx)
      let reviewText = "";
      if (Array.isArray(review.reviewContent)) {
        // Try standard keys first
        const oneliner = review.reviewContent.find((c: any) => c.questionGroup === "DEFAULT_ONELINER")?.rating;
        const opinion = review.reviewContent.find((c: any) => c.questionGroup === "DEFAULT_OPINION")?.rating;

        // Try fallbacks
        const positive = review.reviewContent.find((c: any) => c.questionGroup === "positive")?.rating;
        const general = review.reviewContent.find((c: any) => c.questionGroup === "general_opinion")?.rating;

        reviewText = (opinion || oneliner || positive || general || "").toString();

        // If still empty, grab ANY text content
        if (!reviewText) {
          const anyText = review.reviewContent.find((c: any) => c.rating && c.rating.toString().length > 2);
          if (anyText) reviewText = anyText.rating.toString();
        }
      }

      // Robust Date logic
      let reviewDate = new Date();
      if (review.dateSince) {
        reviewDate = new Date(review.dateSince);
      } else if (review.updatedSince) {
        reviewDate = new Date(review.updatedSince);
      }

      const rating = review.rating || 0;
      const author = review.reviewAuthor || "Anoniem";

      // PREPARE DATA - Check existence to decide on AI generation
      const existing = await prisma.reviewNotification.findUnique({
        where: { reviewId_companyId: { reviewId, companyId } }
      });

      let suggestedResponse = existing?.suggestedResponse || "";
      if (!existing && !suggestedResponse) {
        suggestedResponse = await generateAIResponse(companyName, author, rating, reviewText);
        newCount++;
      }

      // UPSERT to fix broken data in existing records
      await prisma.reviewNotification.upsert({
        where: {
          reviewId_companyId: {
            reviewId,
            companyId,
          },
        },
        update: {
          reviewText: reviewText, // Fix broken text
          reviewDate: reviewDate, // Fix broken date
          reviewRating: rating,
          reviewAuthor: author,
        },
        create: {
          reviewId,
          companyId,
          reviewAuthor: author,
          reviewRating: rating,
          reviewText,
          reviewDate,
          suggestedResponse,
          status: "pending",
          isRead: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      newReviews: newCount,
      message: newCount > 0 ? `${newCount} nieuwe review(s) gevonden` : "Reviews gesynchroniseerd",
    });
  } catch (error) {
    console.error("Sync notifications error:", error);
    return NextResponse.json({ error: "Failed to sync reviews" }, { status: 500 });
  }
}

// PATCH - Update notification status
export async function PATCH(request: NextRequest) {
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

    const { notificationId, status, isRead, markAllRead, archiveAll } = await request.json();

    if (archiveAll) {
      await prisma.reviewNotification.updateMany({
        where: {
          companyId: user.company.id,
          status: { not: "pending" } // Only archive processed notifications
        },
        data: { status: "archived" },
      });
      return NextResponse.json({ success: true });
    }

    if (markAllRead) {
      await prisma.reviewNotification.updateMany({
        where: { companyId: user.company.id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (!notificationId) {
      return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
    }

    const notification = await prisma.reviewNotification.findFirst({
      where: {
        id: notificationId,
        companyId: user.company.id,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (typeof isRead === "boolean") updateData.isRead = isRead;

    await prisma.reviewNotification.update({
      where: { id: notificationId },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update notification error:", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
