import { cn } from './cn';

/** Bloc de chargement pulsé. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('lm-squelette rounded-lg', className)} />;
}

/** Squelette d'une page de module (en-tête, tuiles, tableau). */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Chargement" className="space-y-5">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
