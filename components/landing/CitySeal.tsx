import { cn } from "cn";

/**
 * The city's seal: a ringed civic building, drawn in `currentColor` so it takes the ink of the
 * header and the light text of the footer from one source. Decoration beside the city's name,
 * which is always written out next to it, so it is hidden from a screen reader.
 */
function CitySeal({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={cn("size-12 shrink-0", className)}
      {...props}
    >
      <circle cx="32" cy="32" r="30" strokeWidth="2" />
      <circle cx="32" cy="32" r="25.5" strokeWidth="1" strokeDasharray="1.5 2.5" />
      {/* Pediment, four columns, two steps. */}
      <path d="M19 28 32 19l13 9Z" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22.5 31.5v9.5M28.8 31.5v9.5M35.2 31.5v9.5M41.5 31.5v9.5" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 44h26M17 47.5h30" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export { CitySeal };
