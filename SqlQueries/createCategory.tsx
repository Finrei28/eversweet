import { db } from "~/server/db";

async function main() {
  const category = await db.category.create({
    data: {
      name: "Snack Series",
      chineseName: "小吃系列",
    },
  });
  console.log(`Created category: ${category}`);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await db.$disconnect();
  });
