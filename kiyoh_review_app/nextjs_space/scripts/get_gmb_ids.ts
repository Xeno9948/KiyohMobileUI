import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getGMBIds() {
    console.log("\n🔍 Fetching GMB Account and Location IDs...\n");

    try {
        // Get the company with GMB token
        const company = await prisma.company.findFirst({
            where: {
                gmbAccessToken: {
                    not: null
                }
            }
        });

        if (!company || !company.gmbAccessToken) {
            console.error("❌ No GMB access token found. Please connect your Google account first.");
            process.exit(1);
        }

        console.log(`✅ Found company: ${company.name}`);
        console.log(`📅 Token expires: ${company.gmbTokenExpiry}\n`);

        // Fetch accounts
        console.log("📡 Fetching accounts from Google...");
        const accountsResponse = await fetch(
            "https://mybusinessaccountmanagement.googleapis.com/v1/accounts",
            {
                headers: {
                    Authorization: `Bearer ${company.gmbAccessToken}`,
                },
            }
        );

        if (!accountsResponse.ok) {
            const errorText = await accountsResponse.text();
            console.error("❌ Failed to fetch accounts:", errorText);
            process.exit(1);
        }

        const accountsData = await accountsResponse.json();
        console.log("\n📋 Full Accounts Response:");
        console.log(JSON.stringify(accountsData, null, 2));

        if (!accountsData.accounts || accountsData.accounts.length === 0) {
            console.error("❌ No accounts found");
            process.exit(1);
        }

        const account = accountsData.accounts[0];
        console.log(`\n✅ Account ID: ${account.name}`);

        // Fetch locations
        console.log("\n📡 Fetching locations...");
        const locationsResponse = await fetch(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
            {
                headers: {
                    Authorization: `Bearer ${company.gmbAccessToken}`,
                },
            }
        );

        if (!locationsResponse.ok) {
            const errorText = await locationsResponse.text();
            console.error("❌ Failed to fetch locations:", errorText);
            process.exit(1);
        }

        const locationsData = await locationsResponse.json();
        console.log("\n📋 Full Locations Response:");
        console.log(JSON.stringify(locationsData, null, 2));

        if (!locationsData.locations || locationsData.locations.length === 0) {
            console.error("❌ No locations found");
            process.exit(1);
        }

        const location = locationsData.locations[0];
        console.log(`\n✅ Location ID: ${location.name}`);

        // Update database
        console.log("\n💾 Updating database...");
        await prisma.company.update({
            where: { id: company.id },
            data: {
                gmbAccountId: account.name,
                gmbLocationId: location.name,
            },
        });

        console.log("\n✅ SUCCESS! Database updated with:");
        console.log(`   Account ID: ${account.name}`);
        console.log(`   Location ID: ${location.name}`);
        console.log("\n🎉 You can now fetch GMB reviews!\n");

    } catch (error: any) {
        console.error("\n❌ Error:", error.message);
        if (error.stack) console.error(error.stack);
    } finally {
        await prisma.$disconnect();
    }
}

getGMBIds();
