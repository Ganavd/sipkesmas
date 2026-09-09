import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  WORKFLOW_STATE_LABEL,
  WORKFLOW_STATE_STYLE,
  deriveWorkflowState,
  type WorkflowEntityLike,
  type WorkflowOperationalState,
} from "@/lib/workflow-state";

/**
 * Workflow badge — mendukung dua mode:
 * 1. `entity` prop: turunkan state dari row entitas (5-state operasional).
 * 2. `status` prop (legacy/string): fallback untuk pemakaian lama.
 */
interface Props {
  entity?: WorkflowEntityLike;
  status?: WorkflowOperationalState | string;
  className?: string;
}

function resolveState(p: Props): WorkflowOperationalState {
  if (p.entity) return deriveWorkflowState(p.entity);
  const s = p.status ?? "belum_terdaftar";
  if (s in WORKFLOW_STATE_LABEL) return s as WorkflowOperationalState;
  // Map legacy values dari kolom workflow_status (draft/pending/registered/archived).
  if (s === "registered") return "terdaftar";
  if (s === "pending") return "pending_verifikasi";
  if (s === "archived") return "draft_expired";
  return "belum_terdaftar";
}

export function WorkflowStatusBadge(props: Props) {
  const state = resolveState(props);
  return (
    <Badge variant="outline" className={cn("border-0", WORKFLOW_STATE_STYLE[state], props.className)}>
      {WORKFLOW_STATE_LABEL[state]}
    </Badge>
  );
}