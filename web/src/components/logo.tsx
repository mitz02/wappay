import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <a href="/" className={cn("group flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_6px_16px_-4px_rgba(16,222,107,0.55)] transition-transform duration-200 group-hover:scale-105">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="h-5 w-5 text-white"
        >
          <path
            d="M4 6.5 8.2 18l3.8-7.2L15.8 18 20 6.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
        Wapp<span className="text-brand-600">Pay</span>
      </span>
    </a>
  );
}
