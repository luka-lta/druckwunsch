import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, BanIcon, FlameIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { QUEUE_STATUSES, type PrintRequestResponse, type PrintRequestStatus } from '../../shared/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NEXT_STEP, STATUS_LABELS } from './status';

interface Props {
  request: PrintRequestResponse;
  onChangeStatus: (status: PrintRequestStatus) => void;
  onDelete: () => void;
  onToggleUrgent: () => void;
  /** null: Verschieben in diese Richtung nicht möglich (Anfang/Ende der Spalte) */
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
}

export function AdminActions({ request, onChangeStatus, onDelete, onToggleUrgent, onMoveUp, onMoveDown }: Props) {
  const nextStep = NEXT_STEP[request.status];

  return (
    <>
      {nextStep !== undefined && (
        <Button size="sm" onClick={() => onChangeStatus(nextStep.status)}>
          {nextStep.label} <ArrowRightIcon data-icon="inline-end" />
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Weitere Aktionen">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Status setzen</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={request.status}
            onValueChange={(value) => onChangeStatus(value as PrintRequestStatus)}
          >
            {QUEUE_STATUSES.map((status) => (
              <DropdownMenuRadioItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onToggleUrgent}>
            <FlameIcon /> {request.isUrgent ? 'Nicht mehr dringend' : 'Als dringend markieren'}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={onMoveUp === null} onSelect={() => onMoveUp?.()}>
            <ArrowUpIcon /> Nach oben
          </DropdownMenuItem>
          <DropdownMenuItem disabled={onMoveDown === null} onSelect={() => onMoveDown?.()}>
            <ArrowDownIcon /> Nach unten
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {request.status !== 'rejected' && (
            <DropdownMenuItem onSelect={() => onChangeStatus('rejected')}>
              <BanIcon /> Ablehnen
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2Icon /> Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
