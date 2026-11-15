import {
  CatalogPage,
  type CatalogSearchParams,
} from "@/components/catalog/catalog-page";

type ArabicCatalogPageProps = {
  searchParams: Promise<CatalogSearchParams>;
};

export default function ArabicCatalogPage({
  searchParams,
}: ArabicCatalogPageProps) {
  return <CatalogPage locale="ar" searchParams={searchParams} />;
}
