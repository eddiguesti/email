'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-[var(--muted)] rounded-xl animate-shimmer ${className}`} />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 space-y-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-8 w-full" />
    </div>
  );
}

export function EmailRowSkeleton() {
  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <Skeleton className="w-4 h-4 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20 rounded-lg" />
    </div>
  );
}

export function TodoSkeleton() {
  return (
    <div className="px-5 py-4 flex items-center gap-3">
      <Skeleton className="w-5 h-5 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
