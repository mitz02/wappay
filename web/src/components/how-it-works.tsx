import { WHATSAPP_URL } from "@/lib/site";

const STEPS = [
  {
    n: "01",
    title: "Click “Try WappPay Now”",
    body: "This takes you to WappPay’s chat on WhatsApp.",
    delay: "0ms",
  },
  {
    n: "02",
    title: "Send “Hi WappPay”",
    body: "Message WappPay and tap the onboarding link it sends.",
    delay: "120ms",
  },
  {
    n: "03",
    title: "Verify & set PIN",
    body: "Fill in your NIN or BVN and create a secure 4-digit PIN.",
    delay: "240ms",
  },
  {
    n: "04",
    title: "Start banking",
    body: "Send money, pay bills, buy data — all inside WhatsApp.",
    delay: "360ms",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative isolate scroll-mt-24 overflow-hidden bg-white pt-10 lg:pb-20 lg:pt-28">
      {/* soft top wash + dot texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[460px] bg-[linear-gradient(180deg,rgba(239,254,244,0.9)_0%,rgba(255,255,255,0)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(rgba(8,151,72,0.10)_1.2px,transparent_1.2px)] [background-size:26px_26px] [mask-image:linear-gradient(180deg,black,transparent_90%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-40 -z-10 h-[340px] w-[340px] rounded-full bg-brand-100/70 blur-[100px]"
      />
      <div className="container-site">
        <span className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-5 text-[13px] font-medium text-brand-700 shadow-[0_1px_4px_rgba(31,50,87,0.08)] lg:h-8">
          GET STARTED
        </span>

        <div className="mt-8 flex flex-col gap-4 md:gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
          <h2 className="font-display text-[32px] font-medium leading-[1.08] tracking-tight text-slate-800 md:text-5xl lg:text-6xl">
            Up and running in
            <br className="md:hidden" /> under two minutes.
          </h2>
          <p className="text-slate-500 lg:max-w-[520px] lg:text-slate-700">
            Most banking apps only accept text. WappPay accepts however you
            communicate.
          </p>
        </div>

        {/* Staircase */}
        <ol className="mt-14 grid items-start gap-10 lg:mt-24 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="relative grid animate-fade-up grid-cols-[70px_1fr] lg:block lg:min-h-[190px] lg:pr-8 lg:[&:nth-child(1)]:mt-[168px] lg:[&:nth-child(2)]:mt-[112px] lg:[&:nth-child(3)]:mt-[56px]"
              style={{ animationDelay: s.delay, animationFillMode: "both" }}
            >
              {/* ghost number (mobile) */}
              <span className="col-start-1 font-display text-6xl font-extrabold text-brand-50 lg:hidden">
                {s.n}
              </span>

              {/* divider rule (desktop) */}
              <span
                aria-hidden
                className="absolute inset-y-0 right-0 hidden w-0.5 bg-gradient-to-b from-white via-brand-500 to-brand-700 lg:block"
              />

              {/* step badge (desktop) */}
              <span className="absolute right-4 top-0 hidden rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-700 lg:block">
                Step {i + 1}
              </span>

              <div className="col-start-2 lg:mt-10">
                <h3 className="font-display text-lg font-bold leading-snug text-slate-900 lg:text-xl">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 lg:text-base">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 text-center lg:mt-16">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-whatsapp"
          >
            Start in 2 minutes
          </a>
        </div>
      </div>

      {/* Speed lines */}
      <div className="speed-lines relative mt-24 hidden h-[51px] w-full overflow-hidden lg:block">
        <div className="speed-line" style={{ left: "2%", top: "6px" }} />
        <div className="speed-line" style={{ left: "2%", top: "24px" }} />
        <div className="speed-line" style={{ left: "10%", top: "40px" }} />
        <div className="speed-line" style={{ left: "44%", top: "14px" }} />
        <div className="speed-line speed-line--reverse" style={{ right: "2%", top: "6px" }} />
        <div className="speed-line speed-line--reverse" style={{ right: "2%", top: "24px" }} />
        <div className="speed-line speed-line--reverse" style={{ right: "10%", top: "40px" }} />
        <div className="speed-line speed-line--reverse" style={{ right: "44%", top: "14px" }} />
      </div>
      <div className="mt-16 h-1 w-full bg-brand-600 lg:hidden" />
    </section>
  );
}
