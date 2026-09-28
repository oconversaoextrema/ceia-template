import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface BotaoShinyProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "sm";
}

/** CTA primário da marca: pílula escura com anel esmeralda giratório — escura nos DOIS temas. */
export function BotaoShiny({
  size = "default",
  className,
  children,
  type = "button",
  ...props
}: BotaoShinyProps) {
  return (
    <button
      type={type}
      className={cn(
        "shiny-cta font-medium disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        size === "default" ? "h-11 px-5 text-sm" : "h-9 px-4 text-[13px]",
        className,
      )}
      {...props}
    >
      <span className="shiny-dots" aria-hidden="true" />
      <span className="shiny-cta-content">{children}</span>
    </button>
  );
}
