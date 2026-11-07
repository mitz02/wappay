"use client";

import { useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "What is WappPay?",
    a: "WappPay is an AI-powered financial assistant that lives inside WhatsApp. No app to download, no new interface to learn. You send a message, a picture, or a voice note — and it handles transfers, bill payments, airtime and data top-ups, and spending tracking, all from the chat you already use.",
  },
  {
    q: "How does WappPay work?",
    a: "Message “Hi WappPay” on WhatsApp to start. WappPay parses what you ask for — in English, Pidgin, Hausa, Igbo or Yoruba — then shows a clear confirmation before any money moves. You approve with a tap or your PIN, and it’s done.",
  },
  {
    q: "Is WappPay secure?",
    a: "Yes. Every payment requires your PIN, NIN and BVN details are masked and never stored in full, and all traffic runs over encrypted channels with idempotent transaction handling so nothing is ever charged twice. You can also lock the WappPay chat behind your phone’s biometrics.",
  },
  {
    q: "How do I start using WappPay?",
    a: "Tap “Try WappPay Now”, send “Hi WappPay”, then follow the short onboarding: verify with your NIN or BVN inside a WhatsApp form and set a 4-digit PIN. Your wallet opens at ₦0.00 and you’re ready to transact — usually in under two minutes.",
  },
  {
    q: "What can I actually do with WappPay?",
    a: "Send money to any bank account, fund your WappPay wallet, pay bills, buy airtime and data, check your balance, review recent transactions, and ask for simple spending insights — all from the same chat.",
  },
  {
    q: "What if I lose my phone?",
    a: "Freeze your WappPay account instantly from any WhatsApp device to pause all activity, then go through a secure identity-verified recovery to get back in. Your chat lock and phone biometrics keep others out in the meantime.",
  },
  {
    q: "How do I reach WappPay support?",
    a: "Message WappPay directly in the same WhatsApp chat you use for transactions. Describe your issue — transfer failure, security concern, anything — and it will help instantly or route you to a human agent.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative isolate scroll-mt-24 overflow-hidden bg-white pb-20 pt-5 md:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-40 -z-10 h-[340px] w-[340px] rounded-full bg-brand-100/60 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px] bg-[radial-gradient(ellipse_55%_100%_at_50%_0%,rgba(239,254,244,0.8),transparent_70%)]"
      />
      <div className="container-site relative grid items-start gap-12 xl:grid-cols-[34%_1fr] xl:gap-[10%]">
        {/* Left column */}
        <div className="relative">
          <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-5 text-[13px] font-medium text-brand-700 shadow-[0_1px_4px_rgba(31,50,87,0.08)]">
            FAQ
          </span>
          <h2 className="mt-5 max-w-[370px] font-display text-[34px] font-medium leading-[1.1] tracking-tight text-slate-800 md:text-[46px]">
            Frequently asked questions
          </h2>
          <p className="mt-3 max-w-[443px] text-lg tracking-tight text-slate-500">
            Everything you need to know before you say hi to WappPay.
          </p>

          {/* decorative question mark */}
          <div
            aria-hidden
            className="mt-14 hidden select-none md:block"
          >
            <span className="block font-display text-[170px] font-extrabold leading-[0.8] text-brand-100">
              ?
            </span>
            <span className="-mt-6 ml-16 block font-display text-[90px] font-extrabold leading-[0.8] text-brand-50">
              ?
            </span>
          </div>
        </div>

        {/* Right column: accordion cards */}
        <div className="flex w-full min-w-0 flex-col gap-4">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <article
                key={f.q}
                className="rounded-2xl bg-brand-500/[0.06] px-3 py-3 ring-1 ring-inset ring-brand-100 transition-colors hover:bg-brand-500/[0.09] md:px-5 md:py-4"
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex min-h-[30px] w-full items-center justify-between gap-5 text-left"
                  >
                    <span className="text-base font-medium tracking-tight text-slate-800 md:text-xl">
                      {f.q}
                    </span>
                    <span
                      className={cn(
                        "flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white transition-all duration-300",
                        isOpen ? "bg-brand-600 rotate-45" : "bg-brand-600",
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                </h3>
                <div
                  className={cn(
                    "grid transition-all duration-500 ease-in-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="mt-2 whitespace-pre-line pb-1 pr-8 text-base leading-6 tracking-tight text-slate-500">
                      {f.a}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}

          <a
            href="#faq"
            className="mt-2 inline-flex h-12 items-center gap-2 self-start rounded-xl border border-brand-100 bg-brand-50 px-6 text-sm font-medium text-brand-700 transition-all hover:-translate-y-0.5 hover:bg-brand-100"
          >
            View all FAQs
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
