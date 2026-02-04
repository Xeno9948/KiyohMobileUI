import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create test user
  const hashedPassword = await bcrypt.hash("johndoe123", 12);
  
  const existingUser = await prisma.user.findUnique({
    where: { email: "john@doe.com" }
  });

  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: "john@doe.com",
        password: hashedPassword,
        name: "John Doe",
        role: "user"
      }
    });
    console.log("Test user created");
  } else {
    console.log("Test user already exists");
  }

  // Create superadmin user
  const superadminPassword = await bcrypt.hash("ControlKiyohM17", 12);
  
  const existingSuperadmin = await prisma.user.findUnique({
    where: { email: "ga@kiyoh.co.za" }
  });

  if (!existingSuperadmin) {
    await prisma.user.create({
      data: {
        email: "ga@kiyoh.co.za",
        password: superadminPassword,
        name: "Kiyoh Admin",
        role: "superadmin"
      }
    });
    console.log("Superadmin user created");
  } else {
    // Update existing user to superadmin if role is different
    if (existingSuperadmin.role !== "superadmin") {
      await prisma.user.update({
        where: { email: "ga@kiyoh.co.za" },
        data: { 
          role: "superadmin",
          password: superadminPassword
        }
      });
      console.log("Superadmin user updated");
    } else {
      console.log("Superadmin already exists");
    }
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });