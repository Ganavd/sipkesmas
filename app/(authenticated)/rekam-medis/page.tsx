import { AskepListView } from "@/src/modules/askep/views/askep-list-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rekam Medis | SIPKESMAS",
  description: "Riwayat Asuhan Keperawatan keluarga",
};

export default function RekamMedisPage() {
  return <AskepListView />;
}
