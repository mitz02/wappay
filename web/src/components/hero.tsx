"use client";

import { useEffect, useRef, useState } from "react";
import { PROCESSED_NAIRA, WHATSAPP_URL } from "@/lib/site";

function formatNaira(n: number) {
  return `₦${Math.floor(n).toLocaleString("en-NG")}`;
}

function useCountUp(target: number, run: boolean) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!run) return;
    const duration = 2200;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, run]);

  return value;
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[320px] animate-float sm:max-w-[340px]">
      {/* glow */}
      <div
        aria-hidden
        className="absolute -inset-8 rounded-[48px] bg-gradient-to-b from-brand-200/50 via-brand-100/30 to-transparent blur-2xl"
      />
      {/* device */}
      <div className="relative rounded-[42px] border-[10px] border-slate-900 bg-slate-900 shadow-phone">
        <div className="relative overflow-hidden rounded-[32px] bg-[#EFE7DE]">
          {/* notch */}
          <div className="absolute left-1/2 top-2 z-20 h-6 w-28 -translate-x-1/2 rounded-full bg-slate-900" />
          {/* wa header */}
          <div className="flex items-center gap-3 bg-[#075E54] px-4 pb-3 pt-10 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold">
              W
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">WappPay</p>
              <p className="text-[11px] text-white/70">online · from WappPay</p>
            </div>
          </div>
          {/* chat body */}
          <div className="space-y-2.5 px-3.5 pb-4 pt-4">
            <div className="mx-auto w-fit rounded-md bg-[#FCF4CB] px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm">
              Today
            </div>

            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p className="text-[12.5px] leading-snug text-slate-800">
                Hi 👋 I&apos;m WappPay — your money assistant.
                <br />
                What can I help you with today?
              </p>
              <span className="mt-1 block text-right text-[9px] text-slate-400">
                from WappPay
              </span>
            </div>

            <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 shadow-sm">
              <p className="text-[12.5px] leading-snug text-slate-800">
                Send ₦5,000 to Mum
              </p>
              <span className="mt-1 block text-right text-[9px] text-slate-500">
                9:41 AM ✓✓
              </span>
            </div>

            <div className="max-w-[92%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p className="text-[12.5px] leading-snug text-slate-800">
                Ready to send{" "}
                <span className="font-semibold text-brand-700">₦5,000</span> to{" "}
                <span className="font-semibold">Mum · GTBank</span>.
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-center text-[12px] font-semibold text-brand-700">
                  Confirm · YES
                </div>
                <div className="rounded-lg border border-slate-200 px-3 py-1.5 text-center text-[12px] font-medium text-slate-600">
                  Cancel
                </div>
              </div>
              <span className="mt-1.5 block text-right text-[9px] text-slate-400">
                from WappPay
              </span>
            </div>

            <div className="ml-auto max-w-[70%] rounded-xl rounded-tr-sm bg-[#DCF8C6] px-3 py-2 shadow-sm">
              <p className="text-[12.5px] leading-snug text-slate-800">YES</p>
              <span className="mt-1 block text-right text-[9px] text-slate-500">
                9:41 AM ✓✓
              </span>
            </div>

            <div className="max-w-[88%] rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-sm">
              <p className="text-[12.5px] leading-snug text-slate-800">
                ✅ Sent ₦5,000 to Mum.
                <br />
                New balance:{" "}
                <span className="font-semibold text-brand-700">
                  ₦120,500.00
                </span>
              </p>
              <span className="mt-1 block text-right text-[9px] text-slate-400">
                from WappPay
              </span>
            </div>

            {/* typing indicator */}
            <div className="flex w-14 items-center justify-center gap-1 rounded-xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm animate-pulse-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            </div>
          </div>
          {/* input bar */}
          <div className="flex items-center gap-2 bg-[#EFE7DE] px-3 pb-4 pt-1">
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

      {/* floating chips */}
      <div className="absolute -left-6 top-24 hidden animate-float-slow rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-card-hover sm:block">
        <p className="text-[10px] font-medium text-slate-400">Balance</p>
        <p className="text-sm font-bold text-slate-900">₦120,500.00</p>
      </div>
      <div className="absolute -right-4 bottom-28 hidden animate-float rounded-xl border border-brand-100 bg-white px-3 py-2 shadow-card-hover sm:block">
        <p className="text-[10px] font-medium text-brand-600">Voice note</p>
        <p className="text-xs font-semibold text-slate-700">“Buy 2GB MTN”</p>
      </div>
    </div>
  );
}

export function Hero() {
  const [run, setRun] = useState(false);
  const count = useCountUp(PROCESSED_NAIRA, run);

  useEffect(() => {
    const t = setTimeout(() => setRun(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative overflow-hidden pb-28 pt-28 sm:pb-36 sm:pt-36">
      {/* ── layered background ── */}
      {/* base tint */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#E4FAED_0%,#F3FEF8_45%,#EAFBF1_100%)]"
      />
      {/* dot grid, fading downward */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(8,151,72,0.13)_1.2px,transparent_1.2px)] [background-size:26px_26px] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.9),rgba(0,0,0,0.35)_55%,transparent_85%)]"
      />
      {/* soft glow orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-24 h-[420px] w-[420px] rounded-full bg-brand-300/40 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 h-[380px] w-[380px] rounded-full bg-emerald-200/60 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-160px] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-white/70 blur-[90px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/4 h-[360px] w-[360px] rounded-full bg-brand-200/50 blur-[90px]"
      />
      {/* top radial halo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(ellipse_80%_55%_at_50%_-12%,#d9fee7_0%,rgba(239,254,244,0.75)_45%,transparent_78%)]"
      />
      {/* faint concentric arcs across the hero */}
      <svg
        aria-hidden
        viewBox="0 0 1440 900"
        fill="none"
        className="pointer-events-none absolute inset-x-0 top-0 h-full w-full text-brand-600/[0.07]"
      >
        <ellipse cx="720" cy="430" rx="700" ry="410" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="720" cy="430" rx="540" ry="320" stroke="currentColor" strokeWidth="1.5" />
        <ellipse cx="720" cy="430" rx="380" ry="230" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      {/* curved divider into next section */}
      <svg
        aria-hidden
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 h-[64px] w-full sm:h-[96px]"
      >
        <path
          fill="rgba(255,255,255,0.55)"
          d="M0,74 C300,116 620,28 940,52 C1180,70 1330,102 1440,66 L1440,120 L0,120 Z"
        />
        <path
          fill="#ffffff"
          d="M0,94 C320,124 740,44 1040,64 C1250,78 1370,104 1440,86 L1440,120 L0,120 Z"
        />
      </svg>

      <div className="container-site relative z-10">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <span className="eyebrow">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
            </span>
            Live on WhatsApp
          </span>

          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.05] lg:text-[68px]">
            One chat for
            <br />
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-brand-600 via-brand-500 to-emerald-600 bg-clip-text text-transparent">
                everything money
              </span>
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-1 z-0 h-3 rounded-full bg-brand-100"
              />
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Send money, pay bills, buy airtime &amp; data — all inside WhatsApp
            with an AI that understands your voice, photos, and even Pidgin.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp w-full !px-8 !py-4 text-base sm:w-auto"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
              Try WappPay Now
            </a>
            <a href="#how-it-works" className="btn-ghost w-full !py-4 text-base sm:w-auto">
              See how it works
            </a>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-100 bg-white/70 px-6 py-5 backdrop-blur sm:inline-block">
            <p className="font-display text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
              {formatNaira(count)}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
              has already been processed by WappPay 🎉
            </p>
          </div>
        </div>

        <div className="relative mt-16 sm:mt-20">
          {/* concentric rings behind the phone */}
          <svg
            aria-hidden
            viewBox="0 0 700 700"
            fill="none"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 text-brand-600/20 sm:h-[680px] sm:w-[680px]"
          >
            <circle cx="350" cy="350" r="346" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 7" />
            <circle cx="350" cy="350" r="280" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="350" cy="350" r="214" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 7" />
            <circle cx="350" cy="350" r="152" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
