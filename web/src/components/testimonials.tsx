import { cn } from "@/lib/utils";

type Bubble = {
  quote: string;
  name: string;
  seed: string;
  joined: string;
  tone: "white" | "mint" | "dark" | "pale";
  // desktop scatter position (% of stage)
  pos: { left: string; top: string; width?: string; rotate?: string };
};

const BUBBLES: Bubble[] = [
  {
    quote:
      "I was onboarded in a few minutes and carried out a transaction straight away. What made me marvel was how naturally I could talk to WappPay — I wasn’t forced to follow a prompt.",
    name: "Chinwe Nnanna",
    seed: "chinwe-n",
    joined: "Joined since 2026",
    tone: "white",
    pos: { left: "1%", top: "4%", width: "30%", rotate: "-1.5deg" },
  },
  {
    quote:
      "WappPay is GOATED. Meeting users where they’re at and solving real pain points — all inside WhatsApp.",
    name: "Godswill Favour",
    seed: "godswill-f",
    joined: "Joined since 2025",
    tone: "mint",
    pos: { left: "65%", top: "0%", width: "30%", rotate: "1.5deg" },
  },
  {
    quote:
      "Where has WappPay been all my life? I’ve never moved money this fast 😅 I use it for my business payments every single day.",
    name: "Odafe Amalega",
    seed: "odafe-a",
    joined: "Joined since 2026",
    tone: "dark",
    pos: { left: "4%", top: "52%", width: "30%", rotate: "1deg" },
  },
  {
    quote:
      "As a student, it makes my life easier because I send money directly on WhatsApp. Fast, simple, no app switching.",
    name: "Achuya Moses",
    seed: "achuya-m",
    joined: "Joined since 2026",
    tone: "pale",
    pos: { left: "67%", top: "48%", width: "29%", rotate: "-1deg" },
  },
  {
    quote:
      "I sent a voice note in Pidgin to buy data and it just worked. Na once I unpin my babe come pin WappPay chat 😂",
    name: "Uncanny001",
    seed: "uncanny-001",
    joined: "Joined since 2026",
    tone: "white",
    pos: { left: "34%", top: "72%", width: "32%", rotate: "1deg" },
  },
  {
    quote:
      "Funny how it’s become my personal account for transactions 😭 cause it’s on WhatsApp and I don’t need to switch apps.",
    name: "Glowrey",
    seed: "glowrey-01",
    joined: "Joined since 2025",
    tone: "mint",
    pos: { left: "35%", top: "-2%", width: "30%", rotate: "-1deg" },
  },
];

const TONES: Record<Bubble["tone"], { card: string; text: string; sub: string; tail: string; name: string }> = {
  white: {
    card: "bg-white",
    text: "text-slate-700",
    sub: "text-slate-500",
    tail: "bg-white",
    name: "text-slate-900",
  },
  mint: {
    card: "bg-[#DCF8C6]",
    text: "text-slate-700",
    sub: "text-slate-500",
    tail: "bg-[#DCF8C6]",
    name: "text-slate-900",
  },
  dark: {
    card: "bg-brand-900",
    text: "text-brand-50",
    sub: "text-brand-200/80",
    tail: "bg-brand-900",
    name: "text-white",
  },
  pale: {
    card: "bg-brand-100",
    text: "text-slate-700",
    sub: "text-slate-500",
    tail: "bg-brand-100",
    name: "text-slate-900",
  },
};

function BubbleCard({ b }: { b: Bubble }) {
  const tone = TONES[b.tone];
  return (
    <figure
      className={cn(
        "relative flex min-h-[170px] flex-col justify-between rounded-[16px] p-4 shadow-[0_12px_32px_rgba(0,40,20,0.16)]",
        tone.card,
      )}
      style={{
        transform: `rotate(${b.pos.rotate ?? "0deg"})`,
      }}
    >
      {/* chat tail */}
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-2 left-7 h-5 w-5 rotate-45 rounded-[3px]",
          tone.tail,
        )}
      />
      <blockquote className={cn("relative z-10 text-sm leading-[1.45]", tone.text)}>
        {b.quote}
      </blockquote>
      <figcaption className="relative z-10 mt-4 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://api.dicebear.com/10.x/avataaars/svg?seed=${encodeURIComponent(b.seed)}`}
          alt=""
          className="h-9 w-9 rounded-full bg-white object-cover"
          width={36}
          height={36}
          loading="lazy"
        />
        <div>
          <p className={cn("text-sm font-semibold", tone.name)}>{b.name}</p>
          <p className={cn("text-xs", tone.sub)}>{b.joined}</p>
        </div>
      </figcaption>
    </figure>
  );
}

export function Testimonials() {
  return (
    <section className="relative overflow-hidden bg-brand-600 py-20 md:py-24">
      {/* texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5] bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(255,255,255,0.18),transparent_60%),radial-gradient(ellipse_50%_40%_at_85%_100%,rgba(0,56,27,0.35),transparent_65%)]"
      />

      <div className="container-site relative">
        {/* Mobile / tablet: heading + grid */}
        <div className="text-center xl:hidden">
          <span className="inline-flex h-8 items-center rounded-full border border-white/30 bg-white/10 px-5 text-[13px] font-medium text-white backdrop-blur">
            TESTIMONIAL
          </span>
          <h2 className="mt-5 font-display text-3xl font-medium tracking-tight text-white md:text-5xl">
            Real people.
            <br /> Real results
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:max-w-4xl lg:justify-items-center lg:gap-x-8 lg:gap-y-10 xl:hidden">
            {BUBBLES.map((b) => (
              <div key={b.name} className={b.name === "Glowrey" || b.name === "Uncanny001" ? "lg:col-span-1" : ""}>
                <BubbleCard b={b} />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: scattered chat-bubble collage */}
        <div className="relative mx-auto hidden min-h-[780px] max-w-[1280px] xl:block">
          <div className="absolute left-1/2 top-1/2 z-20 w-[420px] -translate-x-1/2 -translate-y-1/2 text-center">
            <span className="inline-flex h-8 items-center rounded-full border border-white/30 bg-white/10 px-5 text-[13px] font-medium text-white backdrop-blur">
              TESTIMONIAL
            </span>
            <h2 className="mt-5 font-display text-5xl font-medium leading-tight tracking-tight text-white">
              Real people.
              <br /> Real results
            </h2>
          </div>
          {BUBBLES.map((b) => (
            <div
              key={b.name}
              className="absolute z-10 animate-fade-up"
              style={{
                left: b.pos.left,
                top: b.pos.top,
                width: b.pos.width,
                animationDelay: "150ms",
              }}
            >
              <BubbleCard b={b} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
