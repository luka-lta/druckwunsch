import { BoxIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Vorschaubild eines Modells, mit Platzhalter falls MakerWorld kein Bild geliefert hat */
export function ModelThumbnail({ imageUrl, className }: { imageUrl: string | null; className?: string }) {
  if (imageUrl === null) {
    return (
      <div className={cn('flex items-center justify-center rounded-md bg-muted text-muted-foreground', className)}>
        <BoxIcon className="size-1/3 max-h-10 max-w-10 opacity-60" />
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn('rounded-md bg-muted object-cover', className)}
    />
  );
}
