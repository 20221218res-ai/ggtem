const { Client } = require("pg");

const BATCH_LIMIT = Number(process.env.WITHDRAWAL_BATCH_LIMIT ?? 20);
const MIN_QUEUE_AGE_MINUTES = Number(process.env.WITHDRAWAL_QUEUE_AGE_MINUTES ?? 10);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query("begin");

    const queued = await client.query(
      `
        select id, "userId", amount::text, fee::text, chain, destination
          from "WithdrawalRequest"
         where status = 'REQUESTED'::"WithdrawalStatus"
           and "requestedAt" <= now() - ($1::int * interval '1 minute')
         order by "requestedAt" asc
         limit $2
         for update skip locked
      `,
      [MIN_QUEUE_AGE_MINUTES, BATCH_LIMIT],
    );

    for (const request of queued.rows) {
      await client.query(
        `
          update "WithdrawalRequest"
             set status = 'UNDER_REVIEW'::"WithdrawalStatus",
                 "processedAt" = now()
           where id = $1
        `,
        [request.id],
      );

      await client.query(
        `
          insert into "WithdrawalLog"
            (id, "withdrawalRequestId", "userId", action, "statusFrom", "statusTo", message, metadata)
          values
            ($1, $2, $3, 'WITHDRAWAL_QUEUE_PROCESSING', 'REQUESTED', 'UNDER_REVIEW', $4, $5::jsonb)
        `,
        [
          `wlog_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          request.id,
          request.userId,
          "출금 큐 배치가 요청을 검토 대상으로 이동했습니다.",
          JSON.stringify({
            amount: request.amount,
            fee: request.fee,
            chain: request.chain,
            destination: request.destination,
            queueAgeMinutes: MIN_QUEUE_AGE_MINUTES,
          }),
        ],
      );
    }

    await client.query("commit");
    console.log(
      JSON.stringify(
        {
          processed: queued.rowCount,
          status: "UNDER_REVIEW",
          minQueueAgeMinutes: MIN_QUEUE_AGE_MINUTES,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
