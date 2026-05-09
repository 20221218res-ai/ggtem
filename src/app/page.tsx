import { getMarketplaceListings } from "@/lib/market/listings";
import { MarketplaceHome } from "./marketplace-home";

type HomePageProps = {
  searchParams?: Promise<{
    query?: string;
    game?: string;
    category?: string;
    sort?: string;
  }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const view = await getMarketplaceListings({
    query: resolvedSearchParams?.query,
    game: resolvedSearchParams?.game,
    category: resolvedSearchParams?.category,
    sort: resolvedSearchParams?.sort,
    limit: 12,
  });

  return <MarketplaceHome {...view} />;
}
