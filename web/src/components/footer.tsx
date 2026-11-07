import { WHATSAPP_URL } from "@/lib/site";
import { Logo } from "./logo";

const COLUMNS = [
  {
    title: "Personal",
    links: [
      { label: "Airtime & Data", href: "#services" },
      { label: "Send & Receive Money", href: "#services" },
      { label: "Transfers to Africa", href: "#services" },
      { label: "Transfers to China", href: "#services" },
      { label: "Spending Insights", href: "#features" },
    ],
  },
  {
    title: "Product",
    links: [
      { label: "Services", href: "#services" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Security", href: "#security" },
      { label: "FAQs", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Terms of Service", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Support", href: WHATSAPP_URL, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#0B1220_49%,#0D6234_140%)] font-sans text-white">
      {/* background layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_45%_at_50%_110%,rgba(16,222,107,0.35),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-30 bg-[radial-gradient(rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(180deg,transparent,black_35%,black_70%,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/4 -z-10 h-[420px] w-[420px] rounded-full bg-brand-700/30 blur-[110px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 -z-10 h-[360px] w-[360px] rounded-full bg-emerald-500/20 blur-[100px]"
      />
      {/* Block A: CTA */}
      <div className="container-site relative z-10 pt-20 text-center md:pt-28">
        <h2 className="mx-auto max-w-[700px] font-display text-[34px] font-medium leading-tight tracking-tight text-white [text-shadow:1px_1px_30px_rgba(0,0,0,0.25)] md:text-5xl">
          Your bank is a message away.
        </h2>
        <p className="mx-auto mt-4 max-w-[520px] text-base text-slate-300">
          Join thousands of Nigerians who’ve made WhatsApp their wallet. No
          download. No forms. Just say hi.
        </p>
        <div className="mt-8">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[46px] items-center gap-2 rounded-xl border-[0.5px] border-white bg-brand-600 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.14)_0_1px,transparent_1px_6px)] px-7 text-sm font-semibold text-white shadow-[2px_2px_8px_rgba(0,0,0,0.25),inset_4px_4px_11px_rgba(255,255,255,0.25)] transition-transform hover:-translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            Try WappPay Now
          </a>
        </div>
      </div>

      {/* Block B: logo + columns */}
      <div className="container-site relative z-10 mt-16 grid gap-10 border-b border-white/10 pb-10 lg:mt-24 lg:grid-cols-[300px_1fr] lg:gap-24">
        <div>
          <Logo className="[&_span:nth-child(2)]:text-white" />
          <p className="mt-4 max-w-[280px] text-sm leading-relaxed text-slate-400">
            The AI money assistant that lives in WhatsApp. Built for Nigerians
            who want simple, fast, accessible finance.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-slate-400 opacity-70">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      {...(l.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      className="text-sm text-white transition-colors hover:text-brand-300"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Block C: copyright + socials */}
      <div className="container-site relative z-10 flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} WappPay. All rights reserved.
        </p>
        <p className="text-xs text-slate-500">
          Demo / test environment · Wallet balances are MOCK data
        </p>
        <div className="flex items-center gap-4 text-slate-400">
          {["X", "Instagram", "LinkedIn"].map((s) => (
            <a
              key={s}
              href="#"
              className="text-xs transition-colors hover:text-brand-300"
            >
              {s}
            </a>
          ))}
        </div>
      </div>

      {/* Giant watermark */}
      <div
        aria-hidden
        className="pointer-events-none relative -mb-8 select-none overflow-hidden text-center"
      >
        <span className="block translate-y-4 bg-gradient-to-b from-white/[0.14] to-transparent bg-clip-text font-display text-[16vw] font-extrabold leading-none tracking-tight text-transparent">
          WappPay
        </span>
      </div>
    </footer>
  );
}
