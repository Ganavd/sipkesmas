import { AskepDetailView } from "@/src/modules/askep/views/askep-detail-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detail Asuhan Keperawatan | SIPKESMAS",
  description: "Detail dan cetak Asuhan Keperawatan",
};

export default async function AskepDetailPage({
  params,
}: {
  params: Promise<{ askepId: string }>;
}) {
  const { askepId } = await params;
  return <AskepDetailView id={askepId} />;
}
