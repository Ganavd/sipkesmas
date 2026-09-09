import { TimKunjunganView } from "@/src/modules/tim-kunjungan/views/tim-kunjungan-view";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tim Kunjungan | SIPKESMAS",
  description: "Manajemen tim kunjungan untuk puskesmas",
};

export default function TimKunjunganPage() {
  return <TimKunjunganView />;
}
