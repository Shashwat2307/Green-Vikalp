import { prisma } from "@db";
import bcrypt from "bcrypt";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" }
  });

  if (!admin) {
    console.log("No admin found!");
    return;
  }

  const newPassword = "Password123!";
  const hash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: hash }
  });

  console.log(`Password reset for user: ${admin.username}`);
  console.log(`New password: ${newPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
