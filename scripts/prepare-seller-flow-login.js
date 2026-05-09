const fs = require("node:fs");
const { Client } = require("pg");

function readDatabaseUrl() {
  const envText = fs.readFileSync(".env.local", "utf8");
  const match = envText.match(/^DATABASE_URL="?([^"\r\n]+)"?/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  return match[1];
}

async function main() {
  const client = new Client({ connectionString: readDatabaseUrl() });
  await client.connect();

  const result = await client.query(
    `update "User" seller
        set "passwordHash" = buyer."passwordHash",
            role = 'SELLER'::"UserRole",
            status = 'ACTIVE'::"UserStatus",
            "emailVerifiedAt" = coalesce(seller."emailVerifiedAt", now()),
            "updatedAt" = now()
       from "User" buyer
      where seller.email = 'seller-flow-test@ggitem.local'
        and buyer.email = 'user-demo@ggitem.local'
      returning seller.id, seller.email, seller."displayName", seller.role::text`,
  );

  await client.end();

  if (!result.rows[0]) {
    throw new Error("seller-flow-test or user-demo account was not found.");
  }

  console.log(JSON.stringify(result.rows[0], null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
