import { Badge } from '@/components/ui/primitives';
import { statusColor, statusLabel } from '@/lib/domain/labels';
import type { RecipientStatus } from '@/lib/database.types';

export function StatusBadge({ status }: { status: RecipientStatus }) {
  return <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>;
}
