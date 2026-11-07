"use client";

import { useEffect, useState } from "react";
import {
  MessageSquareText,
  Mic,
  PieChart,
  Receipt,
  Languages,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { WHATSAPP_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const FEATURES: Feature[] = [
  {
    icon: MessageSquareText,
    title: "Chat to Pay",
    body: "Tell WappPay what you want to pay for, and a ready-to-send payment request is drafted instantly — confirm with one tap.",
  },
  {
    icon: Mic,
    title: "Voice Notes",
    body: "Send WappPay voice notes in your natural language and get quick financial actions completed inside chat.",
  },
  {
    icon: PieChart,
    title: "Spending Analysis",
    body: "Ask WappPay where your money went and get simple spending insights from your WhatsApp conversations.",
  },
  {
    icon: Receipt,
    title: "Bills Payment",
    body: "Pay bills from chat without jumping across apps or filling long forms.",
  },
  {
    icon: Languages,
    title: "Understands your language",
    body: "Chat in clear simple English, Pidgin, Hausa, Igbo or Yoruba and trust WappPay to understand.",
  },
  {
    icon: LifeBuoy,
    title: "Self Support",
    body: "Get guided answers and quick help whenever you need support — right in the same chat.",
  },
];

const ADVANCE_MS = 6000;

function Bubble({
  side,
  children,
  footer,
}: {
  side: "in" | "out";
  children: React.ReactNode;
  footer?: string;
}) {
  const out = side === "out";
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-xl px-3 py-2 shadow-sm",
        out
          ? "ml-auto rounded-tr-sm bg-[#DCF8C6]"
          : "rounded-tl-sm bg-white",
      )}
    >
      <div className="text-[12.5px] leading-snug text-slate-800">
        {children}
      </div>
      {footer && (
        <span
          className={cn(
            "mt-1 block text-right text-[9px]",
            out ? "text-slate-500" : "text-slate-400",
          )}
        >
          {footer}
        </span>
      )}
    </div>
  );
}

function FeatureScreen({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <>
          <Bubble side="out" footer="9:41 AM ✓✓">
            Sell 2 bags of rice to Chidi
          </Bubble>
          <Bubble side="in" footer="from WappPay">
            Invoice ready 🧾
            <div className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50 p-2.5">
              <p className="text-[11px] font-semibold text-brand-700">
                WAPPAY INVOICE
              </p>
              <p className="mt-0.5 text-[13px] font-bold text-slate-900">
                ₦150,000
              </p>
              <p className="text-[10px] text-slate-500">2 bags of rice · Chidi</p>
            </div>
            <div className="mt-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-center text-[12px] font-semibold text-white">
              Send invoice
            </div>
          </Bubble>
        </>
      );
    case 1:
      return (
        <>
          <Bubble side="out" footer="9:41 AM ✓✓">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white" fill="currentColor">
                  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" />
                </svg>
              </span>
              <span className="flex flex-1 items-center gap-[3px]">
                {[6, 10, 14, 9, 12, 7, 13, 10, 6, 11, 8, 12, 9, 5].map((h, i) => (
                  <span
                    key={i}
                    className="w-[3px] rounded-full bg-brand-500"
                    style={{ height: `${h}px` }}
                  />
                ))}
              </span>
              <span className="text-[10px] text-slate-500">0:07</span>
            </div>
          </Bubble>
          <Bubble side="in" footer="from WappPay">
            Got it 🎙 Buying <b>2GB MTN data</b> — sending now…
          </Bubble>
        </>
      );
    case 2:
      return (
        <>
          <Bubble side="out" footer="9:41 AM ✓✓">
            Where did my money go this week?
          </Bubble>
          <Bubble side="in" footer="from WappPay">
            This week you spent{" "}
            <b className="text-brand-700">₦34,200</b> 💸
            <div className="mt-2 space-y-1.5">
              {[
                ["Food & groceries", 45, "₦15,400"],
                ["Transport", 30, "₦10,300"],
                ["Airtime & data", 25, "₦8,500"],
              ].map(([label, pct, amt]) => (
                <div key={label as string}>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{label}</span>
                    <span>{amt}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full bg-brand-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Bubble>
        </>
      );
    case 3:
      return (
        <>
          <Bubble side="out" footer="9:41 AM ✓✓">
            Pay my EKO electricity bill
          </Bubble>
          <Bubble side="in" footer="from WappPay">
            Ready to pay{" "}
            <b className="text-brand-700">₦7,500</b> · EKO Prepaid
            <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
              <p className="text-slate-500">Meter · 45001234567</p>
              <p className="font-semibold text-slate-800">Adebayo · Ikeja</p>
            </div>
            <div className="mt-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-center text-[12px] font-semibold text-white">
              Confirm · YES
            </div>
          </Bubble>
        </>
      );
    case 4:
      return (
        <>
          <Bubble side="out" footer="9:41 AM ✓✓">
            Send ₦5,000 give my mama
          </Bubble>
          <Bubble side="in" footer="from WappPay">
            No wahala 😄 Sending{" "}
            <b className="text-brand-700">₦5,000</b> to Mummy&apos;s GTBank.
            Confirm?
            <div className="mt-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-center text-[12px] font-semibold text-white">
              Confirm · YES
            </div>
          </Bubble>
        </>
      );
    default:
      return (
        <>
          <Bubble side="out" footer="9:41 AM ✓✓">
            My transfer failed but money left my account
          </Bubble>
          <Bubble side="in" footer="from WappPay">
            I&apos;ve checked — no money left your wallet ✅ The debit was from
            your bank, not WappPay. Want me to draft a dispute message for you?
            <div className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-center text-[12px] font-semibold text-brand-700">
              Yes, draft it
            </div>
          </Bubble>
        </>
      );
  }
}

function PhoneDock({ index }: { index: number }) {
  return (
    <div className="relative mx-auto aspect-[508/1028] h-full max-h-[640px] lg:absolute lg:right-[5%] lg:top-[6%] lg:m-0 lg:h-[86%] lg:max-h-none">
      <div className="relative h-full overflow-hidden rounded-[36px] border-[9px] border-slate-900 bg-slate-900 shadow-phone">
        <div className="relative flex h-full flex-col overflow-hidden rounded-[28px] bg-[#EFE7DE]">
          <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-slate-900" />
          <div className="flex items-center gap-3 bg-[#075E54] px-4 pb-3 pt-9 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold">
              W
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">WappPay</p>
              <p className="text-[10px] text-white/70">online</p>
            </div>
          </div>
          <div className="flex-1 space-y-2.5 overflow-hidden px-3.5 pb-3 pt-4">
            <div className="mx-auto w-fit rounded-md bg-[#FCF4CB] px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
              Today
            </div>
            <div
              key={index}
              className="animate-fade-up space-y-2.5"
            >
              <FeatureScreen index={index} />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 pb-4 pt-1">
            <div className="flex-1 rounded-full bg-white px-4 py-2 text-[12px] text-slate-400 shadow-sm">
              Message
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="currentColor">
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(
      () => setActive((i) => (i + 1) % FEATURES.length),
      ADVANCE_MS,
    );
    return () => clearTimeout(t);
  }, [active, paused]);

  return (
    <section id="features" className="relative z-20 isolate scroll-mt-24 bg-white pb-16 pt-8 md:pb-20 md:pt-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/4 -z-10 h-[420px] w-[420px] rounded-full bg-brand-100/70 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-36 bottom-10 -z-10 h-[380px] w-[380px] rounded-full bg-emerald-50 blur-[90px]"
      />
      <div className="mx-auto w-[calc(100%-35px)] max-w-[1280px] md:w-[90%]">
        <div className="text-center">
          <span className="feature-pill inline-flex h-[26px] min-w-[104px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-brand-700 shadow-[0_1px_4px_rgba(31,50,87,0.08)]">
            FEATURES
          </span>
          <h2 className="mt-5 font-display text-3xl font-medium leading-[1.08] tracking-tight text-slate-800 md:text-[46px] lg:text-[52px]">
            Your financial assistant
            <br className="hidden sm:block" /> in every chat
          </h2>
        </div>

        {/* Showcase panel */}
        <div className="relative mt-10 rounded-[28px] bg-gradient-to-b from-brand-100 via-brand-50 to-[#EAFBF1] p-4 sm:p-6 lg:aspect-[2560/1740] lg:p-0">
          {/* Phone dock (desktop) */}
          <div className="hidden lg:block">
            <PhoneDock index={active} />
          </div>

          {/* Accordion card */}
          <div
            className="relative z-10 rounded-[18px] bg-white p-4 shadow-[0_24px_60px_rgba(28,54,105,0.10)] sm:p-6 lg:absolute lg:left-[2.5%] lg:top-[4.7%] lg:h-[90.6%] lg:w-[38%] lg:overflow-y-auto"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="divide-y divide-slate-100">
              {FEATURES.map((f, i) => {
                const isActive = i === active;
                return (
                  <div key={f.title} className="py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-expanded={isActive}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
                          isActive
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        <f.icon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <span
                        className={cn(
                          "font-display text-base font-bold transition-colors duration-300 sm:text-lg",
                          isActive ? "text-slate-900" : "text-slate-400",
                        )}
                      >
                        {f.title}
                      </span>
                    </button>
                    <div
                      className={cn(
                        "grid transition-all duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)]",
                        isActive
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-3">
                          <p className="max-w-[430px] text-sm leading-relaxed text-slate-500">
                            {f.body}
                          </p>
                          <a
                            href={WHATSAPP_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-4 py-2.5 text-xs font-semibold text-white shadow-[2px_2px_8px_rgba(0,0,0,0.18),inset_4px_4px_11px_rgba(255,255,255,0.25)] transition-transform hover:-translate-y-0.5 sm:text-sm"
                          >
                            Try WappPay Now
                          </a>
                          <div className="relative mt-5 h-1 overflow-hidden rounded-lg bg-slate-100">
                            {isActive && !paused && (
                              <div
                                key={active}
                                className="feature-progress h-full origin-left rounded-lg bg-brand-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phone (mobile / tablet) */}
          <div className="relative mt-6 h-[520px] lg:hidden">
            <PhoneDock index={active} />
          </div>
        </div>
      </div>
    </section>
  );
}
