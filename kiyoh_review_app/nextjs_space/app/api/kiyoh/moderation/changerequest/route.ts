import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { company: true }
    });

    if (!user?.company) {
      return NextResponse.json(
        { error: 'Company not configured', needsSetup: true },
        { status: 400 }
      );
    }

    const { reviewId } = await request.json();

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing required field: reviewId' },
        { status: 400 }
      );
    }

    const { locationId, apiToken, tenantId, baseUrl } = user.company;

    const apiResponse = await fetch(`${baseUrl}/v1/publication/review/changerequest`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Publication-Api-Token': apiToken,
      },
      body: JSON.stringify({
        locationId,
        tenantId,
        reviewId,
      }),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('Kiyoh change request API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to submit change request', details: errorText },
        { status: apiResponse.status }
      );
    }

    return NextResponse.json({ success: true, message: 'Change request sent to reviewer' });
  } catch (error) {
    console.error('Change request error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
