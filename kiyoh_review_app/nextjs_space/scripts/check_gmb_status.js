const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("\n=== GMB Connection Status ===\n");

    const companies = await prisma.company.findMany({
        select: {
            id: true,
            name: true,
            gmbEnabled: true,
            gmbAccountId: true,
            gmbLocationId: true,
            gmbTokenExpiry: true,
            updatedAt: true
        }
    });

    companies.forEach(company => {
        console.log(`Company: ${company.name}`);
        console.log(`  GMB Enabled: ${company.gmbEnabled}`);
        console.log(`  Account ID: ${company.gmbAccountId || '❌ NOT SET'}`);
        console.log(`  Location ID: ${company.gmbLocationId || '❌ NOT SET'}`);
        console.log(`  Token Expires: ${company.gmbTokenExpiry || '❌ NOT SET'}`);
        console.log(`  Last Updated: ${company.updatedAt}`);
        console.log();

        if (!company.gmbAccountId || !company.gmbLocationId) {
            console.log("⚠️  ACTION NEEDED: You need to connect or reconnect your Google account!");
            console.log("   1. Go to Settings page in your app");
            console.log("   2. Find the 'Google My Business' section");
            console.log("   3. Click 'Connect Google Account'");
            console.log("   4. Complete the OAuth flow");
            console.log();
        }
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
