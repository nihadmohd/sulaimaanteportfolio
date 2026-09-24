import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { SITE } from "@/lib/constants";

type Props = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // In Next 15+, params is a Promise.
  const resolvedParams = await params;
  const slug = resolvedParams.slug || [];

  if (slug[0] === "blog" && slug[1]) {
    try {
      const post = await db.post.findUnique({
        where: { slug: slug[1] },
        select: { title: true, seoTitle: true, excerpt: true, seoDescription: true, coverImageUrl: true, ogImageUrl: true },
      });
      if (post) {
        const title = post.seoTitle || post.title;
        const description = post.seoDescription || post.excerpt || post.title;
        const image = post.ogImageUrl || post.coverImageUrl || SITE.ogImage;
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            images: [image.startsWith("http") ? image : `${SITE.url}${image}`],
          },
        };
      }
    } catch {
      // DB unavailable
    }
  }

  if (slug[0] === "store" && slug[1]) {
    try {
      const product = await db.product.findUnique({
        where: { slug: slug[1] },
        select: { name: true, tagline: true, imageUrl: true },
      });
      if (product) {
        const title = `${product.name} — Honest Review & Best Price`;
        const description = product.tagline || `Honest review of ${product.name} — specs, pros, cons and the best price in INR, curated by MN.KP.`;
        const image = product.imageUrl || SITE.ogImage;
        return {
          title,
          description,
          openGraph: {
            title,
            description,
            images: [image.startsWith("http") ? image : `${SITE.url}${image}`],
          },
        };
      }
    } catch {
      // DB unavailable
    }
  }

  return {};
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug || [];
  const initialPath = "/" + slug.join("/");
  
  return <AppShell initialPath={initialPath} />;
}
