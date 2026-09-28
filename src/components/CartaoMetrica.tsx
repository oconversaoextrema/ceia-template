import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { num } from "@/lib/format";

/** Quadrante de número das métricas: só rótulo e valor. */
export function CartaoMetrica({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <Card className="p-5">
      <span className="text-caption font-medium uppercase tracking-label text-muted-foreground">
        {rotulo}
      </span>
      <p className="mt-2 text-heading-lg tabular-nums text-foreground">{num(valor)}</p>
    </Card>
  );
}

/** Esqueleto da grade de métricas (quatro cartões por padrão). */
export function SkeletonMetricas({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: quantidade }, (_, i) => (
        <Card key={i} className="p-5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-8 w-16" />
        </Card>
      ))}
    </div>
  );
}
