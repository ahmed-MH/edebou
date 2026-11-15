import { ProductDetailPage } from "@/components/product/product-detail-page";

type ArabicProductPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArabicProductPage({
  params,
}: ArabicProductPageProps) {
  const { slug } = await params;
  return <ProductDetailPage locale="ar" rawSlug={slug} />;
}
