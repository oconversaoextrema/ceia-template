import type { ReactNode } from "react";

/** Rótulo + campo, com dica opcional embaixo. */
export function Campo({
  rotulo,
  htmlFor,
  dica,
  children,
}: {
  rotulo: string;
  htmlFor?: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-label-md text-foreground">
          {rotulo}
        </label>
      ) : (
        <span className="block text-label-md text-foreground">{rotulo}</span>
      )}
      {children}
      {dica && <p className="text-caption text-muted-foreground">{dica}</p>}
    </div>
  );
}
