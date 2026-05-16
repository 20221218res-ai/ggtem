import CountryText from "@/app/country-text";
import PageLoading from "@/components/page-loading";

export default function Loading() {
  return <PageLoading label={<CountryText id="auth.signInTitle" />} variant="compact" />;
}
