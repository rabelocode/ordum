import { Skeleton } from './Skeleton';

export function PageShellSkeleton() {
  return (
    <div className="min-h-screen bg-[#F6F5F2]" aria-busy="true" aria-label="Carregando página">
      <div className="border-b border-[#DDD8CF] bg-white px-5 py-4"><Skeleton className="h-9 w-40" /></div>
      <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
        <div className="space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>
        <MetricGridSkeleton />
        <ListSkeleton rows={5} />
      </main>
    </div>
  );
}

export function MetricGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Carregando indicadores">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-[#DDD8CF] bg-white p-5">
          <Skeleton className="h-3 w-24" /><Skeleton className="mt-4 h-8 w-20" /><Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#DDD8CF] bg-white" aria-busy="true" aria-label="Carregando listagem">
      <div className="flex gap-4 border-b border-[#E8E3DB] bg-[#F6F5F2] p-4"><Skeleton className="h-3 w-1/3" /><Skeleton className="h-3 w-1/4" /><Skeleton className="h-3 w-1/5" /></div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex flex-col gap-3 border-b border-[#EEEAE3] p-4 last:border-0 sm:flex-row sm:items-center">
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/3" /></div>
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6 p-5 sm:p-8" aria-busy="true" aria-label="Carregando detalhes">
      <Skeleton className="h-5 w-32" />
      <div className="rounded-3xl border border-[#DDD8CF] bg-white p-6"><Skeleton className="h-9 w-72 max-w-full" /><Skeleton className="mt-3 h-4 w-96 max-w-full" /></div>
      <div className="grid gap-4 md:grid-cols-2"><ListSkeleton rows={3} /><ListSkeleton rows={3} /></div>
    </div>
  );
}
