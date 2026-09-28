import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * O tailwind-merge não conhece a escala tipográfica do DS (`text-heading-*`,
 * `text-body-*`, `text-label-*`, `text-caption`, `text-eyebrow`, definida no
 * `@theme` do styles.css) e a tratava como cor: `cn("text-label-lg",
 * "text-primary")` descartava o tamanho. Registrá-la como `font-size` faz o
 * `cn` manter as duas classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "heading-xl",
            "heading-lg",
            "heading-md",
            "heading-sm",
            "body-xl",
            "body-lg",
            "body-md",
            "body-sm",
            "label-lg",
            "label-md",
            "caption",
            "eyebrow",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
