import { BookmarkIcon, CheckIcon, CircleDashedIcon, ClockIcon, PackageCheckIcon, PrinterIcon, XIcon } from 'lucide-react';
import type { PrintRequestStatus } from '../../shared/api';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { STATUS_BADGE_CLASSES, STATUS_DESCRIPTIONS, STATUS_LABELS } from './status';

const STATUS_ICONS = {
  saved: BookmarkIcon,
  new: CircleDashedIcon,
  accepted: ClockIcon,
  printing: PrinterIcon,
  done: CheckIcon,
  collected: PackageCheckIcon,
  rejected: XIcon,
} satisfies Record<PrintRequestStatus, unknown>;

export function StatusBadge({ status, className }: { status: PrintRequestStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={cn(STATUS_BADGE_CLASSES[status], className)}>
          <Icon data-icon="inline-start" />
          {STATUS_LABELS[status]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{STATUS_DESCRIPTIONS[status]}</TooltipContent>
    </Tooltip>
  );
}
