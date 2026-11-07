import { Lock, Fingerprint, EyeOff, Landmark } from "lucide-react";

const LAYERS = [
  {
    icon: Lock,
    title: "Passcode for every payment",
    body: "Every transaction is protected with your PIN. You are fully in control — nothing moves without your say-so.",
  },
  {
    icon: Fingerprint,
    title: "Lock your WappPay chat",
    body: "Hide your WappPay conversations in a locked folder, accessible only with your phone’s password or biometrics.",
  },
  {
    icon: EyeOff,
    title: "Private by design",
    body: "Your NIN and BVN are masked in chat and never shown or stored in full — and never logged in plaintext, ever.",
  },
  {
    icon: Landmark,
    title: "Bank-grade rails",
    body: "Transactions run on encrypted, idempotent payment rails — the same discipline banks rely on.",
  },
];

export function Security() {
  return (
    <section id="security" className="relative isolate scroll-mt-24 overflow-hidden bg-white py-16 md:py-28">
      {/* subtle corner glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/4 -z-10 h-[380px] w-[380px] rounded-full bg-brand-100/60 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 bottom-0 -z-10 h-[340px] w-[340px] rounded-full bg-emerald-50 blur-[90px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(217,254,231,0.55),transparent_70%)]"
      />
      <div className="container-site">
        <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-5 text-[13px] font-medium text-brand-700 shadow-[0_1px_4px_rgba(31,50,87,0.08)]">
          WAPPAY SECURITY
        </span>

        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:justify-between lg:gap-16">
          <h2 className="max-w-xl font-display text-[34px] font-medium leading-[1.1] tracking-tight text-slate-800 md:text-[48px]">
            Secured with multiple layers of security.
          </h2>
          <p className="max-w-[520px] text-base leading-relaxed text-slate-600 md:text-lg">
            Your money is protected at every step, from the passcode you set to
            the encrypted systems running quietly behind it.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {LAYERS.map((l) => (
            <article
              key={l.title}
              className="relative isolate flex aspect-[986/760] flex-col overflow-hidden rounded-[14px] bg-brand-50 md:aspect-[986/900]"
            >
              {/* soft decorative glow instead of lottie canvas */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-200/60 blur-3xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-brand-100 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_80%_0%,rgba(16,222,107,0.18),transparent_60%)]"
              />

              <h3 className="relative z-10 px-7 pt-7 font-display text-xl font-bold leading-snug text-brand-900">
                {l.title}
              </h3>

              <div className="relative z-10 mt-auto grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 rounded-[20px] bg-white px-5 py-4 shadow-[0_14px_32px_rgba(34,75,125,0.10)] md:mx-5 md:mb-5 md:min-h-[112px]">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white md:h-14 md:w-14">
                  <l.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <p className="text-sm leading-relaxed text-slate-600 md:text-base">
                  {l.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
