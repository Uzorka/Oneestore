/**
 * A loading placeholder that holds the same space as the thing it stands in
 * for, so nothing jumps when the content lands. We never use a full-screen
 * spinner.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-rule ${className}`} />;
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-paper p-2.5">
      <div className="h-26 animate-pulse rounded-xl bg-rule" />
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-3.5 w-2/5" />
    </div>
  );
}
