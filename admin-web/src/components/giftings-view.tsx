'use client';

import React, { useMemo, useState } from 'react';
import {
  Gift,
  Send,
  Sparkles,
  Heart,
  Search,
  Download,
  TrendingUp,
  Users,
  Wallet,
  AlertTriangle,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  RotateCcw,
  ChevronDown,
  X,
} from 'lucide-react';

type GiftType = 'Airtime' | 'Data' | 'Cash';
type GiftStatus = 'DELIVERED' | 'PENDING' | 'REVERSED';
type Occasion = 'Birthday' | 'Anniversary' | 'Thank You' | 'Celebration' | 'Just Because';

interface GiftRow {
  id: string;
  recipient: string;
  phone: string;
  type: GiftType;
  occasion: Occasion;
  amount: number;
  status: GiftStatus;
  time: string;
}

const OCCASIONS: Occasion[] = [
  'Birthday',
  'Anniversary',
  'Thank You',
  'Celebration',
  'Just Because',
];

const RECENT_GIFTS: GiftRow[] = [
  {
    id: 'GFT_1793553515_440B',
    recipient: 'Chiamaka Obi',
    phone: '+234 803 *** 4521',
    type: 'Airtime',
    occasion: 'Birthday',
    amount: 5000,
    status: 'DELIVERED',
    time: 'Just now',
  },
  {
    id: 'GFT_1793553200_A1B2',
    recipient: 'Tunde Adeyemi',
    phone: '+234 809 *** 8765',
    type: 'Data',
    occasion: 'Thank You',
    amount: 2500,
    status: 'DELIVERED',
    time: '6 mins ago',
  },
  {
    id: 'GFT_1793552999_8899',
    recipient: 'Ngozi Eze',
    phone: '+234 701 *** 3344',
    type: 'Cash',
    occasion: 'Celebration',
    amount: 20000,
    status: 'PENDING',
    time: '14 mins ago',
  },
  {
    id: 'GFT_1793552700_7C4D',
    recipient: 'Emeka Okafor',
    phone: '+234 706 *** 1188',
    type: 'Airtime',
    occasion: 'Just Because',
    amount: 1000,
    status: 'DELIVERED',
    time: '28 mins ago',
  },
  {
    id: 'GFT_1793552100_5E9F',
    recipient: 'Aisha Bello',
    phone: '+234 812 *** 9900',
    type: 'Data',
    occasion: 'Anniversary',
    amount: 8000,
    status: 'REVERSED',
    time: '52 mins ago',
  },
  {
    id: 'GFT_1793551800_2F0A',
    recipient: 'Ifeanyi Nwosu',
    phone: '+234 814 *** 6677',
    type: 'Cash',
    occasion: 'Birthday',
    amount: 50000,
    status: 'DELIVERED',
    time: '1 hr ago',
  },
];

const KPIS = [
  {
    label: 'Gifts Delivered (30d)',
    value: '1,286',
    delta: '+18.4%',
    trend: 'up',
    icon: Gift,
    tone: 'emerald',
    points: '3,14 22,12 41,16 60,8 79,10 98,4',
  },
  {
    label: 'Total Gift Value',
    value: '₦4,820,500',
    delta: '+12.2%',
    trend: 'up',
    icon: Wallet,
    tone: 'violet',
    points: '3,16 22,14 41,9 60,12 79,6 98,3',
  },
  {
    label: 'Recipients Reached',
    value: '942',
    delta: '+9.1%',
    trend: 'up',
    icon: Users,
    tone: 'sky',
    points: '3,12 22,15 41,10 60,14 79,8 98,6',
  },
  {
    label: 'Reversed / Failed',
    value: '7',
    delta: '-1.2%',
    trend: 'down',
    icon: AlertTriangle,
    tone: 'amber',
    points: '3,5 22,9 41,7 60,12 79,10 98,15',
  },
];

const TOP_OCCASIONS: Array<{ occasion: Occasion; count: number; share: number }> = [
  { occasion: 'Birthday', count: 486, share: 38 },
  { occasion: 'Thank You', count: 312, share: 24 },
  { occasion: 'Celebration', count: 248, share: 19 },
  { occasion: 'Anniversary', count: 154, share: 12 },
  { occasion: 'Just Because', count: 86, share: 7 },
];

const TYPE_STYLES: Record<GiftType, string> = {
  Airtime: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  Data: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  Cash: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
};

const STATUS_STYLES: Record<GiftStatus, { cls: string; icon: React.ElementType }> = {
  DELIVERED: {
    cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    icon: CheckCircle2,
  },
  PENDING: {
    cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    icon: Clock,
  },
  REVERSED: {
    cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
    icon: RotateCcw,
  },
};

const TONE_STYLES: Record<string, string> = {
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  sky: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

const AMOUNT_PRESETS = [500, 1000, 2000, 5000];

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Sparkline({ points, className }: { points: string; className: string }) {
  return (
    <svg viewBox="0 0 100 20" className="h-8 w-24 overflow-visible" fill="none" aria-hidden="true">
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      />
    </svg>
  );
}

export function GiftingsView() {
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<'All' | GiftType>('All');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [giftType, setGiftType] = useState<GiftType>('Airtime');
  const [amount, setAmount] = useState(2000);
  const [customAmount, setCustomAmount] = useState('');
  const [occasion, setOccasion] = useState<Occasion>('Birthday');
  const [message, setMessage] = useState('Wishing you a day as bright as you are. Enjoy! 🎉');
  const [sent, setSent] = useState(false);

  const filteredGifts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return RECENT_GIFTS.filter((gift) => {
      const matchesType = activeType === 'All' || gift.type === activeType;
      const matchesQuery =
        q.length === 0 ||
        gift.recipient.toLowerCase().includes(q) ||
        gift.id.toLowerCase().includes(q) ||
        gift.phone.includes(q);
      return matchesType && matchesQuery;
    });
  }, [query, activeType]);

  const effectiveAmount = useMemo(() => {
    const parsed = Number(customAmount.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : amount;
  }, [amount, customAmount]);

  const handleSendGift = () => {
    setSent(true);
    setRecipientName('');
    setRecipientPhone('');
    setCustomAmount('');
    setTimeout(() => setSent(false), 4000);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
              <Sparkles className="h-3 w-3" /> New
            </span>
            <span className="text-xs text-slate-500">WhatsApp gifting rails · Sandbox</span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">Giftings Command Center</h2>
          <p className="mt-1 text-sm text-slate-400">
            Issue, track and reconcile customer gifts delivered over WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800/70 hover:text-white">
            <Download className="h-4 w-4" /> Export report
          </button>
          <button
            onClick={() => document.getElementById('gift-composer')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <Gift className="h-4 w-4" /> Create gift
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          const positive = kpi.trend === 'up';
          return (
            <div
              key={kpi.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-5 transition hover:border-slate-700"
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${TONE_STYLES[kpi.tone]}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <Sparkline
                  points={kpi.points}
                  className={positive ? 'text-emerald-400/70' : 'text-amber-400/70'}
                />
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-400">
                {kpi.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-white">{kpi.value}</p>
              <p
                className={`mt-1 flex items-center gap-1 text-xs font-medium ${
                  positive ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                <TrendingUp className={`h-3.5 w-3.5 ${positive ? '' : 'rotate-180'}`} />
                {kpi.delta} vs last month
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent gifts */}
        <div className="xl:col-span-2 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Recent Gifts</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Real-time delivery feed from the gift ledger.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search recipient or ID"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-8 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 sm:w-56"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      aria-label="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-slate-800/70 px-5 py-3">
              {(['All', 'Airtime', 'Data', 'Cash'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activeType === type
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Gift</th>
                    <th className="px-5 py-3 font-semibold">Recipient</th>
                    <th className="px-5 py-3 font-semibold">Occasion</th>
                    <th className="px-5 py-3 font-semibold">Value</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Sent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredGifts.map((gift) => {
                    const StatusIcon = STATUS_STYLES[gift.status].icon;
                    return (
                      <tr key={gift.id} className="transition hover:bg-slate-800/30">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-emerald-400">
                              <Gift className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="font-mono text-[11px] text-slate-400">{gift.id}</p>
                              <span
                                className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold ${TYPE_STYLES[gift.type]}`}
                              >
                                {gift.type}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium text-white">{gift.recipient}</p>
                          <p className="text-xs text-slate-400">{gift.phone}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-0.5 text-xs text-slate-300">
                            <Heart className="h-3 w-3 text-rose-400" /> {gift.occasion}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-semibold text-white">{formatNaira(gift.amount)}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[gift.status].cls}`}
                          >
                            <StatusIcon className="h-3 w-3" /> {gift.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">{gift.time}</td>
                      </tr>
                    );
                  })}
                  {filteredGifts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                        No gifts match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
              <span>
                Showing {filteredGifts.length} of {RECENT_GIFTS.length} live gifts
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Streaming
              </span>
            </div>
          </div>

          {/* Occasion breakdown */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Top Occasions</h3>
                <p className="mt-0.5 text-xs text-slate-400">Gift volume by reason this month.</p>
              </div>
              <span className="rounded-full border border-slate-700/60 bg-slate-800/40 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                Last 30 days
              </span>
            </div>
            <div className="space-y-4">
              {TOP_OCCASIONS.map((item) => (
                <div key={item.occasion}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">{item.occasion}</span>
                    <span className="text-slate-400">
                      {item.count.toLocaleString()} · {item.share}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                      style={{ width: `${item.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gift composer */}
        <div id="gift-composer" className="xl:col-span-1">
          <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
            <div className="border-b border-slate-800 p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <Send className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">Send a Gift</h3>
                  <p className="text-xs text-slate-400">Deliver in seconds via WhatsApp</p>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              {/* Recipient */}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Recipient
                </label>
                <div className="space-y-2">
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  />
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      inputMode="tel"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Gift type */}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Gift type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Airtime', 'Data', 'Cash'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setGiftType(type)}
                      className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                        giftType === type
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {AMOUNT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setAmount(preset);
                        setCustomAmount('');
                      }}
                      className={`rounded-lg border px-1 py-2 text-xs font-semibold transition ${
                        amount === preset && !customAmount
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      ₦{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
                <input
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Or enter a custom amount"
                  inputMode="decimal"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
              </div>

              {/* Occasion */}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
                  Occasion
                </label>
                <div className="relative">
                  <select
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value as Occasion)}
                    className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 pr-9 text-sm text-slate-200 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  >
                    {OCCASIONS.map((option) => (
                      <option key={option} value={option} className="bg-slate-900">
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-medium uppercase tracking-wider text-slate-400">
                  <span>Personal message</span>
                  <span className="normal-case tracking-normal text-slate-500">{message.length}/120</span>
                </label>
                <div className="relative">
                  <MessageSquare className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                  <textarea
                    value={message}
                    maxLength={120}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div className="rounded-xl border border-slate-700/60 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-violet-500/15 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                    <Sparkles className="h-3 w-3" /> Live preview
                  </span>
                  <Heart className="h-4 w-4 text-rose-400" />
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  A {giftType.toLowerCase()} gift for
                </p>
                <p className="text-lg font-bold text-white">
                  {recipientName.trim() || 'Your recipient'}
                </p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-emerald-300">
                  {formatNaira(effectiveAmount)}
                </p>
                <p className="mt-2 rounded-lg border border-white/5 bg-slate-950/40 p-2 text-xs italic text-slate-300">
                  “{message.trim() || 'Add a personal message...'}”
                </p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Gift className="h-3 w-3" /> {occasion}
                  </span>
                  <span>{recipientPhone.trim() || '+234 --- --- ----'}</span>
                </div>
              </div>

              <button
                onClick={handleSendGift}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                <Send className="h-4 w-4" /> Send gift
              </button>

              {sent && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>
                    Gift queued for delivery. The recipient will receive a WhatsApp notification with
                    the gift and your message.
                  </span>
                </div>
              )}

              <p className="text-center text-[11px] text-slate-500">
                All gifts are simulated in the sandbox environment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
