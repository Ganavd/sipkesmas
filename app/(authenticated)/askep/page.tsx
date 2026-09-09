import { AskepListView } from "@/src/modules/askep/views/askep-list-view";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Asuhan Keperawatan | SIPKESMAS",
  description: "Daftar Asuhan Keperawatan pasien",
};

export default function AskepPage() {
  return <AskepListView />;
}
