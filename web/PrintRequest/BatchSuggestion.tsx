import { useState } from 'react';
import { Layers3Icon, Loader2Icon, PrinterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { BatchGroup } from './batchGroups';

interface Props {
  group: BatchGroup;
  onPrintAll: (group: BatchGroup) => Promise<void>;
}

/** Vorschlag, mehrere gleichfarbige Wünsche zusammen auf eine Druckplatte zu legen */
export function BatchSuggestion({ group, onPrintAll }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const pieceCount = group.requests.reduce((sum, request) => sum + request.quantity, 0);

  const handleClick = async () => {
    setIsRunning(true);
    try {
      await onPrintAll(group);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card size="sm" className="border-dashed bg-primary/5 ring-primary/30">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Layers3Icon className="size-4 text-primary" />
          Sammeldruck: {group.requests.length} Wünsche in {group.colorLabel}
        </div>
        <ul className="text-xs text-muted-foreground">
          {group.requests.map((request) => (
            <li key={request.id} className="truncate">
              {request.quantity}× {request.title} · {request.requesterName}
            </li>
          ))}
        </ul>
        <Button size="sm" onClick={() => void handleClick()} disabled={isRunning}>
          {isRunning ? <Loader2Icon className="animate-spin" /> : <PrinterIcon />}
          Alle zusammen drucken ({pieceCount} Teile)
        </Button>
      </CardContent>
    </Card>
  );
}
