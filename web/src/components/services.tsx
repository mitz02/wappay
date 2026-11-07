import { Smartphone, ArrowLeftRight, Globe2, Plane } from "lucide-react";
import { WHATSAPP_URL } from "@/lib/site";

const SERVICES = [
  {
    icon: Smartphone,
    title: "Airtime & Data",
    body: "Buy airtime and top up data for MTN, Airtel, Glo and 9mobile in seconds — straight from chat, no app switching.",
  },
  {
    icon: ArrowLeftRight,
    title: "Send & Receive Money",
    body: "Send money to anyone and receive money from anyone — instantly, securely, and without leaving WhatsApp.",
  },
  {
    icon: Globe2,
    title: "Transfers Across Africa",
    body: "Send money to bank accounts in any African country — Kenya, Cameroon, Ghana, South Africa and more — at fair rates.",
  },
  {
    icon: Plane,
    title: "Transfers to China",
    body: "Pay suppliers, tuition or family in China with direct transfers to Chinese bank accounts — fast and reliable.",
  },
];

export function Services() {
  return (
    <section
      id="services"
      className="relative isolate scroll-mt-24 overflow-hidden bg-white py-16 md:py-24"
    >
      {/* soft background glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/3 -z-10 h-[380px] w-[380px] rounded-full bg-brand-100/60 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-0 -z-10 h-[340px] w-[340px] rounded-full bg-emerald-50 blur-[90px]"
      />
      <div className="container-site">
        <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-5 text-[13px] font-medium text-brand-700 shadow-[0_1px_4px_rgba(31,50,87,0.08)]">
          OUR SERVICES
        </span>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:justify-between lg:gap-16">
          <h2 className="max-w-xl font-display text-[34px] font-medium leading-[1.1] tracking-tight text-slate-800 md:text-[48px]">
            Everything you need,
            <br className="hidden sm:block" /> in one chat.
          </h2>
          <p className="max-w-[520px] text-base leading-relaxed text-slate-600 md:text-lg">
            From airtime top-ups to money transfers across Africa and beyond —
            here is what you can do with WappPay, right inside WhatsApp.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s) => (
            <article
              key={s.title}
              className="group relative isolate flex flex-col overflow-hidden rounded-[14px] border border-slate-100 bg-white p-6 shadow-[0_14px_32px_rgba(34,75,125,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-[0_20px_44px_rgba(34,75,125,0.12)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-brand-100/70 blur-2xl transition-opacity duration-300 group-hover:opacity-0"
              />
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[2px_2px_8px_rgba(0,0,0,0.12)]">
                <s.icon className="h-6 w-6" strokeWidth={2} />
              </span>
              <h3 className="relative z-10 mt-5 font-display text-lg font-bold leading-snug text-slate-900">
                {s.title}
              </h3>
              <p className="relative z-10 mt-2 text-sm leading-relaxed text-slate-600">
                {s.body}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-12">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp"
          >
            Try WappPay Now
          </a>
        </div>
      </div>
    </section>
  );
}
