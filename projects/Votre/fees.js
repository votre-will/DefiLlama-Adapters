import { Adapter, FetchOptions } from "../../adapters/types";
import { request, gql } from "graphql-request";

const BASE_MAINNET_SUBGRAPH_URL =
  "https://api.goldsky.com/api/public/project_cm3exke617zqh01074tulgtx0/subgraphs/collar-base-mainnet/0.1.2/gn";

const fetch = async ({ createBalances, fromTimestamp, toTimestamp }: FetchOptions) => {
  const balances = createBalances();

  const query = gql`
    query Fees($from: Int!, $to: Int!) {
      loans(where: { createdAt_gte: $from, createdAt_lt: $to }) {
        feesPaid
        interestAccrued
        loansNFT {
          underlying
        }
      }
    }
  `;

  const data = await request(BASE_MAINNET_SUBGRAPH_URL, query, {
    from: fromTimestamp,
    to: toTimestamp,
  });

  for (const loan of data.loans) {
    const underlying = loan.loansNFT?.underlying;
    if (!underlying) continue;

    const totalFees = BigInt(loan.feesPaid) + BigInt(loan.interestAccrued);

    // Example: assume 20% goes to protocol, 80% to lenders
    const protocolShare = (totalFees * 20n) / 100n;
    const supplySideShare = totalFees - protocolShare;

    balances.add("dailyFees", underlying, totalFees.toString());
    balances.add("dailyProtocolRevenue", underlying, protocolShare.toString());
    balances.add("dailySupplySideRevenue", underlying, supplySideShare.toString());
  }

  return {
    dailyFees: balances.getBalance("dailyFees"),
    dailyProtocolRevenue: balances.getBalance("dailyProtocolRevenue"),
    dailySupplySideRevenue: balances.getBalance("dailySupplySideRevenue"),
  };
};

const adapter: Adapter = {
  adapter: {
    base: {
      fetch,
      start: 1714608000, // Replace with your actual start timestamp
      meta: {
        methodology:
          "Revenue and fees are calculated from fees paid and interest accrued on loans. 20% assumed protocol fee split.",
      },
    },
  },
};

export default adapter;
