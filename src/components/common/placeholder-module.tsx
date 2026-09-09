import { Construction } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

interface PlaceholderModuleProps {
  title: string;
  description: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function PlaceholderModule({
  title,
  description,
  emptyTitle = "Modul akan segera tersedia",
  emptyDescription = "Foundation arsitektur telah disiapkan. Fitur ini akan dibangun pada fase berikutnya.",
}: PlaceholderModuleProps) {
  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />
      <EmptyState icon={Construction} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
