'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  RefreshCw,
  CheckCheck,
  Wifi,
  Smartphone,
  CreditCard,
  Zap,
  Gift,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Check,
  Radio,
} from 'lucide-react';

// ============================================================================
// Official Vector Telco Brand Logos (MTN, Airtel, Glo, 9mobile)
// ============================================================================

export function NetworkLogo({
  network,
  className = 'h-9 w-9',
}: {
  network: string;
  className?: string;
}) {
  const net = network.toUpperCase();

  // 🟡 MTN Nigeria Official Oval Logo
  if (net.includes('MTN')) {
    return (
      <div
        className={`${className} rounded-xl bg-[#FFCC00] flex items-center justify-center p-1 shadow-sm border border-amber-400/80 flex-shrink-0 transition-transform group-hover:scale-105`}
        title="MTN Nigeria"
      >
        <svg viewBox="0 0 44 26" className="w-full h-full" fill="none">
          <ellipse cx="22" cy="13" rx="20" ry="11" stroke="#000000" strokeWidth="2.5" fill="#FFCC00" />
          <text
            x="22"
            y="17"
            textAnchor="middle"
            fill="#000000"
            fontSize="11.5"
            fontWeight="900"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.6"
          >
            MTN
          </text>
        </svg>
      </div>
    );
  }

  // 🔴 Airtel Nigeria Official Brand Logo
  if (net.includes('AIRTEL')) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-[#FF1A1A] to-[#D90000] flex items-center justify-center p-1.5 shadow-sm border border-red-400/80 flex-shrink-0 transition-transform group-hover:scale-105`}
        title="Airtel Nigeria"
      >
        <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
          <path
            d="M16 4C9.37 4 4 9.37 4 16c0 4.14 2.11 7.79 5.33 9.94.38-.45.92-.85 1.57-1.12 2.8-1.15 5.5-.32 7.8 1.48.58.45 1.15.58 1.7.35.54-.23.95-.7 1.15-1.32.74-2.28 2.22-3.8 4.28-4.43.32-.1.54-.3.67-.58C27.53 18.79 28 17.44 28 16c0-6.63-5.37-12-12-12zm-3.2 13.8c-1.8 0-3.2-1.4-3.2-3.2s1.4-3.2 3.2-3.2 3.2 1.4 3.2 3.2-1.4 3.2-3.2 3.2z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    );
  }

  // 🟢 Glo Nigeria Official Green Brand Logo
  if (net.includes('GLO')) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-[#00A859] to-[#006837] flex items-center justify-center p-1 shadow-sm border border-emerald-400/80 flex-shrink-0 transition-transform group-hover:scale-105`}
        title="Glo Nigeria"
      >
        <svg viewBox="0 0 36 26" className="w-full h-full" fill="none">
          <circle cx="18" cy="13" r="11" fill="#008848" />
          <text
            x="18"
            y="17"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="12.5"
            fontWeight="900"
            fontStyle="italic"
            fontFamily="system-ui, sans-serif"
          >
            glo
          </text>
        </svg>
      </div>
    );
  }

  // 🟢 9mobile Official Emerald & Lime Logo
  if (net.includes('9MOBILE') || net.includes('ETISALAT')) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-br from-[#00573F] to-[#003828] flex items-center justify-center p-1 shadow-sm border border-emerald-600/80 flex-shrink-0 transition-transform group-hover:scale-105`}
        title="9mobile Nigeria"
      >
        <svg viewBox="0 0 32 32" className="w-full h-full" fill="none">
          <circle cx="16" cy="16" r="13" fill="#004D36" />
          <circle cx="21" cy="10" r="3" fill="#A0CF67" />
          <path
            d="M16 8c-4.42 0-8 3.58-8 8 0 2.8 1.44 5.3 3.65 6.7.4.26.94.14 1.2-.26.26-.4.14-.94-.26-1.2-1.7-1.08-2.8-2.95-2.8-5.24 0-3.3 2.7-6 6-6s6 2.7 6 6c0 1.4-.48 2.7-1.3 3.73l-3.6 4.6c-.34.43-.27 1.05.16 1.39.43.34 1.05.27 1.39-.16l3.8-4.85C23.2 19.3 24 17.7 24 16c0-4.42-3.58-8-8-8z"
            fill="#FFFFFF"
          />
        </svg>
      </div>
    );
  }

  // Generic Icon Fallback
  return (
    <div className={`${className} rounded-xl bg-white/20 flex items-center justify-center font-bold text-white text-xs`}>
      {network.slice(0, 3)}
    </div>
  );
}

interface ChatOption {
  id: string;
  label: string;
  sub?: string;
  network?: string;
  badge?: string;
  price?: string;
  plan?: string;
  validity?: string;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  options?: ChatOption[];
  networkContext?: string;
}

export function WhatsAppSimulatorView() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: 'Hey 👋',
      timestamp: '12:30 PM',
    },
    {
      id: 'm2',
      sender: 'bot',
      text: 'Are you available for a New UI Project',
      timestamp: '12:30 PM',
    },
    {
      id: 'm3',
      sender: 'user',
      text: 'Hello!',
      timestamp: '12:31 PM',
    },
    {
      id: 'm4',
      sender: 'user',
      text: 'yes, have some space for the new task',
      timestamp: '12:31 PM',
    },
    {
      id: 'm5',
      sender: 'bot',
      text: 'Cool, should I share the details now?',
      timestamp: '12:32 PM',
    },
    {
      id: 'm6',
      sender: 'user',
      text: 'Yes Sure, please',
      timestamp: '12:32 PM',
    },
    {
      id: 'm7',
      sender: 'bot',
      text: 'Welcome to WAPPay! 🚀\nI can help you buy instant mobile data, top-up airtime, transfer funds, or check balances. Tap an option below to test:',
      timestamp: '12:33 PM',
      options: [
        { id: 'buy data', label: '🌐 Buy Data Bundle', sub: 'MTN, Airtel, Glo, 9mobile', badge: '3% Cashback' },
        { id: 'buy airtime', label: '⚡ Buy Airtime', sub: 'Instant Recharge', badge: 'Bonus' },
        { id: 'balance', label: '💰 Check Balance', sub: 'Authoritative Ledger Balance' },
        { id: 'gift', label: '🎁 Gift Shop', sub: 'Send Airtime, Data or Cash' },
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState('2348012345678');
  const [customerName, setCustomerName] = useState('David Adeleke');
  const [deviceFrame, setDeviceFrame] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Extract clickable button options with brand logos & badges from bot responses
  const extractInteractiveButtons = (text: string): { options?: ChatOption[]; networkContext?: string } => {
    // 1. Mobile Network Selection for Data
    if (text.includes('SELECT DATA NETWORK') || text.includes('SELECT MOBILE NETWORK FOR DATA')) {
      return {
        options: [
          {
            id: 'MTN',
            label: 'MTN Nigeria',
            sub: 'Instant 4G/5G Broadband',
            network: 'MTN',
            badge: '⚡ 3% Cashback',
          },
          {
            id: 'AIRTEL',
            label: 'Airtel Nigeria',
            sub: 'Smart Speed & Video Streaming',
            network: 'AIRTEL',
            badge: '🔴 3% Cashback',
          },
          {
            id: 'GLO',
            label: 'Glo Nigeria',
            sub: 'Unlimited Grand Masters of Data',
            network: 'GLO',
            badge: '🟢 3% Cashback',
          },
          {
            id: '9MOBILE',
            label: '9mobile Nigeria',
            sub: 'Super Fast Blaze Data',
            network: '9MOBILE',
            badge: '⚡ 3% Cashback',
          },
        ],
      };
    }

    // 2. Data Plans Selection
    if (text.includes('SELECT DATA PLAN')) {
      const isAirtel = text.includes('Airtel');
      const isGlo = text.includes('Glo');
      const is9mobile = text.includes('9mobile');
      const net = isAirtel ? 'AIRTEL' : isGlo ? 'GLO' : is9mobile ? '9MOBILE' : 'MTN';

      if (isAirtel) {
        return {
          networkContext: 'AIRTEL',
          options: [
            { id: '1GB', label: '1GB Data', sub: 'Daily Plan', plan: '1GB', price: '₦350', validity: '24 Hours', badge: 'Daily' },
            { id: '2GB', label: '2GB Data', sub: '2-Day Plan', plan: '2GB', price: '₦600', validity: '2 Days', badge: 'Popular' },
            { id: '5GB', label: '5GB Data', sub: 'Weekly Plan', plan: '5GB', price: '₦1,500', validity: '7 Days', badge: '🔥 Best Seller' },
            { id: '10GB', label: '10GB Data', sub: 'Monthly Plan', plan: '10GB', price: '₦3,000', validity: '30 Days', badge: 'Monthly' },
            { id: '20GB', label: '20GB Data', sub: 'Heavy Streaming', plan: '20GB', price: '₦5,000', validity: '30 Days', badge: '💎 Max' },
          ],
        };
      }

      if (isGlo) {
        return {
          networkContext: 'GLO',
          options: [
            { id: '1.25GB', label: '1.25GB Data', sub: 'Daily Plan', plan: '1.25GB', price: '₦350', validity: '24 Hours', badge: 'Daily' },
            { id: '2.5GB', label: '2.5GB Data', sub: '2-Day Berekete', plan: '2.5GB', price: '₦600', validity: '2 Days', badge: 'Popular' },
            { id: '5.8GB', label: '5.8GB Data', sub: 'Weekly Plan', plan: '5.8GB', price: '₦1,500', validity: '7 Days', badge: '🔥 Best Value' },
            { id: '10GB', label: '10GB Data', sub: 'Monthly Plan', plan: '10GB', price: '₦3,000', validity: '30 Days', badge: 'Monthly' },
            { id: '18GB', label: '18GB Data', sub: 'Grand Masters', plan: '18GB', price: '₦5,000', validity: '30 Days', badge: '💎 Mega' },
          ],
        };
      }

      if (is9mobile) {
        return {
          networkContext: '9MOBILE',
          options: [
            { id: '1GB', label: '1GB Data', sub: 'Daily Plan', plan: '1GB', price: '₦350', validity: '24 Hours', badge: 'Daily' },
            { id: '2.5GB', label: '2.5GB Data', sub: '2-Day Blaze', plan: '2.5GB', price: '₦600', validity: '2 Days', badge: 'Popular' },
            { id: '5GB', label: '5GB Data', sub: 'Weekly Plan', plan: '5GB', price: '₦1,500', validity: '7 Days', badge: '🔥 Best Value' },
            { id: '11GB', label: '11GB Data', sub: 'Monthly Plan', plan: '11GB', price: '₦3,000', validity: '30 Days', badge: 'Monthly' },
            { id: '20GB', label: '20GB Data', sub: 'Heavy User', plan: '20GB', price: '₦5,000', validity: '30 Days', badge: '💎 Max' },
          ],
        };
      }

      // MTN Default
      return {
        networkContext: 'MTN',
        options: [
          { id: '1GB', label: '1GB Data', sub: 'Daily Plan', plan: '1GB', price: '₦350', validity: '24 Hours', badge: 'Daily' },
          { id: '2.5GB', label: '2.5GB Data', sub: '2-Day Plan', plan: '2.5GB', price: '₦600', validity: '2 Days', badge: 'Popular' },
          { id: '5GB', label: '5GB Data', sub: 'Weekly Plan', plan: '5GB', price: '₦1,500', validity: '7 Days', badge: '🔥 Best Value' },
          { id: '10GB', label: '10GB Data', sub: 'Monthly Plan', plan: '10GB', price: '₦3,000', validity: '30 Days', badge: 'Monthly' },
          { id: '20GB', label: '20GB Data', sub: 'Heavy User Plan', plan: '20GB', price: '₦5,000', validity: '30 Days', badge: '💎 Max' },
        ],
      };
    }

    // 3. Airtime Network Selection
    if (text.includes('SELECT MOBILE NETWORK') || text.includes('Instant Mobile Airtime Top-Up')) {
      return {
        options: [
          { id: 'MTN', label: 'MTN Nigeria', sub: 'Instant Recharge', network: 'MTN', badge: '3% Cashback' },
          { id: 'AIRTEL', label: 'Airtel Nigeria', sub: 'Smart Top-Up', network: 'AIRTEL', badge: '3% Cashback' },
          { id: 'GLO', label: 'Glo Nigeria', sub: 'Berekete Talk', network: 'GLO', badge: '3% Cashback' },
          { id: '9MOBILE', label: '9mobile', sub: 'Super Fast Top-Up', network: '9MOBILE', badge: '3% Cashback' },
        ],
      };
    }

    // 4. Airtime Packages Selection
    if (text.includes('SELECT AIRTIME AMOUNT')) {
      return {
        options: [
          { id: '500', label: '₦500 Airtime', sub: 'Pay ₦485 (Save ₦15)', badge: 'Save ₦15' },
          { id: '1000', label: '₦1,000 Airtime', sub: 'Pay ₦970 (Save ₦30)', badge: '🔥 Popular' },
          { id: '2000', label: '₦2,000 Airtime', sub: 'Pay ₦1,940 (Save ₦60)', badge: 'Save ₦60' },
          { id: '5000', label: '₦5,000 Airtime', sub: 'Pay ₦4,850 (Save ₦150)', badge: '💎 Value' },
        ],
      };
    }

    // 5. Transfer Confirmation
    if (text.includes('Reply *YES* to confirm') || text.includes('Simulated Transfer Confirmation')) {
      return {
        options: [
          { id: 'YES', label: '✅ Confirm & Send Transfer', sub: 'Execute simulated debit', badge: 'Instant' },
          { id: 'CANCEL', label: '❌ Cancel Transaction', sub: 'Safely abort', badge: 'Safe' },
        ],
      };
    }

    return {};
  };

  const handleSendMessage = async (rawText: string) => {
    const textToSend = rawText.trim();
    if (!textToSend || loading) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append outgoing user message (Clean white bubble on the right)
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // 1. Send to backend simulator endpoint
      const res = await fetch('http://localhost:3000/api/v1/admin/simulator/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedPhone,
          message: textToSend,
          contactName: customerName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const replyText = data.reply || '';
        const { options, networkContext } = extractInteractiveButtons(replyText);

        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            options,
            networkContext,
          },
        ]);
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to client-side simulated interactive assistant if offline
    }

    // Client-side fallback with authentic telco state machine
    setTimeout(() => {
      let reply = '';
      const lower = textToSend.toLowerCase();

      if (lower.includes('data') || lower.includes('bundle') || lower.includes('internet')) {
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║         🌐 SELECT DATA NETWORK        ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `⚡ *Instant Mobile Internet Data Top-Up*\n` +
          `🎁 *Bonus:* Get *3% instant cashback* on every bundle!\n` +
          `📞 *Beneficiary Line:* \`${selectedPhone}\`\n\n` +
          `Please choose your mobile network with the official logos below:`;
      } else if (['mtn', 'airtel', 'glo', '9mobile'].includes(lower)) {
        const net = textToSend.toUpperCase();
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║          🌐 SELECT DATA PLAN          ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `📶 *Network:* *${net} Nigeria*\n` +
          `📱 *Recipient:* \`${selectedPhone}\`\n` +
          `🎁 *Bonus:* 3% Instant Cashback\n\n` +
          `Choose your ${net} data bundle (clickable buttons below):`;
      } else if (
        ['1gb', '2gb', '2.5gb', '5gb', '5.8gb', '10gb', '11gb', '18gb', '20gb'].some((p) =>
          lower.includes(p),
        )
      ) {
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║     🌐 DATA RECHARGE SUCCESSFUL       ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `✅ *Simulated Data Bundle Purchase Successful!*\n\n` +
          `• *Network:* 🟡 MTN Nigeria\n` +
          `• *Plan:* *${textToSend.toUpperCase()} High-Speed Broadband*\n` +
          `• *Beneficiary Phone:* \`${selectedPhone}\`\n` +
          `• *Amount Debited:* *₦600.00*\n` +
          `• *Cashback Earned:* *+₦18.00* (3% instant bonus)\n` +
          `• *New Balance:* *₦249,400.00*\n` +
          `• *Ref:* \`MOCK_DAT_${Date.now()}_F90\`\n\n` +
          `🚀 _Simulated 4G/5G high-speed data active immediately! Enjoy browsing._`;
      } else if (lower.includes('balance') || lower.includes('how much')) {
        reply =
          `💳 *Account Balance Update*\n\n` +
          `👤 *Account Name:* ${customerName}\n` +
          `🏦 *Account Number:* \`0123456789\` (WAPPay Microfinance)\n` +
          `💰 *Available Balance:* *₦250,000.00*\n` +
          `🔒 *Tier:* Tier 2 (Verified)\n\n` +
          `_All funds are simulated in sandbox mode._`;
      } else if (lower.includes('airtime') || lower.includes('recharge')) {
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║         📱 SELECT MOBILE NETWORK      ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `⚡ *Instant Mobile Airtime Top-Up*\n` +
          `🎁 *Bonus:* Get *3% instant cashback* on every recharge!\n` +
          `📞 *Beneficiary Line:* \`${selectedPhone}\`\n\n` +
          `Please choose your mobile network:`;
      } else if (lower === 'cancel') {
        reply = '❌ *Operation Cancelled*\n\nNo funds were debited from your account. What else would you like to do?';
      } else {
        reply =
          `👋 *Hello ${customerName}!*\n\n` +
          `I am ready to assist you. Try clicking one of the buttons below:`;
      }

      const { options, networkContext } = extractInteractiveButtons(reply);

      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options,
          networkContext,
        },
      ]);
      setLoading(false);
    }, 500);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'm1',
        sender: 'bot',
        text: 'Hey 👋',
        timestamp: '12:30 PM',
      },
      {
        id: 'm2',
        sender: 'bot',
        text: 'Are you available for a New UI Project',
        timestamp: '12:30 PM',
      },
      {
        id: 'm3',
        sender: 'user',
        text: 'Hello!',
        timestamp: '12:31 PM',
      },
      {
        id: 'm4',
        sender: 'user',
        text: 'yes, have some space for the new task',
        timestamp: '12:31 PM',
      },
      {
        id: 'm5',
        sender: 'bot',
        text: 'Cool, should I share the details now?',
        timestamp: '12:32 PM',
      },
      {
        id: 'm6',
        sender: 'user',
        text: 'Yes Sure, please',
        timestamp: '12:32 PM',
      },
      {
        id: 'm7',
        sender: 'bot',
        text: 'Welcome to WAPPay! 🚀\nI can help you buy instant mobile data, airtime, transfer money, or check balances. Tap an option below to test:',
        timestamp: '12:33 PM',
        options: [
          { id: 'buy data', label: '🌐 Buy Data Bundle', sub: 'MTN, Airtel, Glo, 9mobile', badge: '3% Cashback' },
          { id: 'buy airtime', label: '⚡ Buy Airtime', sub: 'Instant Recharge', badge: 'Bonus' },
          { id: 'balance', label: '💰 Check Balance', sub: 'Wallet Balance' },
          { id: 'gift', label: '🎁 Gift Shop', sub: 'Send a Surprise Gift' },
        ],
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Top Controls Toolbar */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 mb-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white">WhatsApp Chat Simulator</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                Exact Layout & Logos
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Matches your periwinkle-purple layout with authentic MTN, Airtel, Glo & 9mobile SVG logos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Customer Switcher */}
          <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-500">Customer:</span>
            <select
              value={selectedPhone}
              onChange={(e) => {
                setSelectedPhone(e.target.value);
                if (e.target.value === '2348012345678') setCustomerName('Adebayo Ogunlesi');
                if (e.target.value === '2348023456789') setCustomerName('Chioma Okonkwo');
                if (e.target.value === '2348034567890') setCustomerName('Babatunde Adeleke');
              }}
              className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
            >
              <option value="2348012345678" className="bg-slate-900 text-white">
                Adebayo (+2348012345678)
              </option>
              <option value="2348023456789" className="bg-slate-900 text-white">
                Chioma (+2348023456789)
              </option>
              <option value="2348034567890" className="bg-slate-900 text-white">
                Babatunde (+2348034567890)
              </option>
            </select>
          </div>

          {/* Toggle Device Mockup */}
          <button
            onClick={() => setDeviceFrame(!deviceFrame)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition flex items-center gap-1.5 ${
              deviceFrame
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            {deviceFrame ? 'Phone Frame' : 'Full Width'}
          </button>

          {/* Reset Button */}
          <button
            onClick={handleResetChat}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5 border border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Demo
          </button>
        </div>
      </div>

      {/* Main Chat Stage */}
      <div className="flex-1 flex justify-center items-center overflow-hidden">
        <div
          className={`h-full flex flex-col transition-all duration-300 shadow-2xl overflow-hidden ${
            deviceFrame
              ? 'w-full max-w-[480px] rounded-3xl border-[6px] border-slate-800 ring-1 ring-slate-700'
              : 'w-full rounded-2xl border border-slate-800'
          }`}
          style={{
            // EXACT Background matching your screenshot: vibrant periwinkle purple
            background: '#5855f4',
          }}
        >
          {/* WhatsApp Header */}
          <div className="px-5 py-3.5 bg-black/15 backdrop-blur-md border-b border-white/10 flex items-center justify-between text-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-base text-white shadow-inner">
                  W
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-[#5855f4]"></span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm leading-tight text-white tracking-wide">
                    WAPPay Banking Bot
                  </h3>
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />
                </div>
                <p className="text-[11px] text-white/70 leading-tight mt-0.5">
                  Official WhatsApp Assistant · Online
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-medium text-white border border-white/20 backdrop-blur-sm">
                ₦250,000.00
              </span>
            </div>
          </div>

          {/* Chat Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3.5 scrollbar-thin scrollbar-thumb-white/20">
            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'} animate-in fade-in duration-200`}
                >
                  {/* Speech Bubble */}
                  <div
                    className={`max-w-[88%] text-[14.5px] leading-relaxed transition shadow-sm ${
                      isBot
                        ? /* EXACT Incoming Bubble: Semi-transparent purple/lavender pill, crisp white text */
                          'bg-white/20 backdrop-blur-sm text-white rounded-3xl rounded-tl-lg px-5 py-3'
                        : /* EXACT Outgoing Bubble: Crisp solid white, deep purple-slate text, slight top-right angle */
                          'bg-white text-[#2d2956] font-medium rounded-3xl rounded-tr-md px-5 py-3 shadow-md'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                    <div
                      className={`text-[10px] mt-1 text-right flex items-center justify-end gap-1 ${
                        isBot ? 'text-white/60' : 'text-[#2d2956]/50'
                      }`}
                    >
                      <span>{msg.timestamp}</span>
                      {!isBot && <CheckCheck className="h-3 w-3 text-indigo-500 inline" />}
                    </div>
                  </div>

                  {/* Clickable Interactive Buttons (Under Bot Message) */}
                  {isBot && msg.options && msg.options.length > 0 && (
                    <div className="mt-3 w-full max-w-[88%] space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[11px] font-semibold tracking-wider uppercase text-white/80 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-amber-300" /> Tap to Select:
                        </p>
                        {msg.networkContext && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] text-white">
                            <NetworkLogo network={msg.networkContext} className="h-3.5 w-3.5" />
                            <span>{msg.networkContext}</span>
                          </div>
                        )}
                      </div>

                      {/* Network Selection Buttons (with Official Logos) */}
                      {msg.options[0]?.network ? (
                        <div className="grid grid-cols-1 gap-2">
                          {msg.options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleSendMessage(opt.id)}
                              className="w-full text-left bg-white/95 hover:bg-white text-[#2a2652] hover:text-indigo-900 rounded-2xl p-3 shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] border border-white/40 flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                {/* Official Vector Telco Logo */}
                                <NetworkLogo network={opt.network || opt.id} className="h-10 w-10" />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm text-[#2a2652] group-hover:text-indigo-950">
                                      {opt.label}
                                    </p>
                                    {opt.badge && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
                                        {opt.badge}
                                      </span>
                                    )}
                                  </div>
                                  {opt.sub && (
                                    <p className="text-xs text-slate-500 mt-0.5 group-hover:text-slate-700">
                                      {opt.sub}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                            </button>
                          ))}
                        </div>
                      ) : msg.options[0]?.plan ? (
                        /* Data Packages Grid Cards */
                        <div className="grid grid-cols-1 gap-2">
                          {msg.options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleSendMessage(opt.id)}
                              className="w-full text-left bg-white/95 hover:bg-white text-[#2a2652] hover:text-indigo-900 rounded-2xl p-3 shadow-md transition-all hover:scale-[1.01] active:scale-[0.99] border border-white/40 flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center font-black text-indigo-700 text-xs">
                                  <Wifi className="h-4 w-4 text-indigo-600 mb-0.5" />
                                  <span className="text-[10px] leading-none font-bold">{opt.plan}</span>
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-bold text-sm text-[#2a2652] group-hover:text-indigo-950">
                                      {opt.label}
                                    </p>
                                    {opt.badge && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                                        {opt.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5">
                                    Valid {opt.validity} • 3% Cashback
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-extrabold text-sm text-emerald-600">{opt.price}</p>
                                <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 flex items-center gap-0.5 justify-end mt-0.5 font-medium">
                                  Select <ChevronRight className="h-3 w-3 inline" />
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        /* Generic / Action Buttons */
                        <div className="grid grid-cols-1 gap-1.5">
                          {msg.options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleSendMessage(opt.id)}
                              className="w-full text-left bg-white/95 hover:bg-white text-[#2a2652] hover:text-indigo-900 rounded-2xl px-4 py-2.5 shadow-sm transition hover:scale-[1.01] active:scale-[0.99] border border-white/40 flex items-center justify-between group"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-xs text-[#2a2652] group-hover:text-indigo-900">
                                    {opt.label}
                                  </p>
                                  {opt.badge && (
                                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-600">
                                      {opt.badge}
                                    </span>
                                  )}
                                </div>
                                {opt.sub && (
                                  <p className="text-[11px] text-slate-500 group-hover:text-slate-700 mt-0.5">
                                    {opt.sub}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white rounded-3xl rounded-tl-lg px-4 py-3 w-fit animate-pulse">
                <span className="h-2 w-2 rounded-full bg-white animate-bounce"></span>
                <span className="h-2 w-2 rounded-full bg-white animate-bounce delay-100"></span>
                <span className="h-2 w-2 rounded-full bg-white animate-bounce delay-200"></span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Suggestion Chips */}
          <div className="px-4 py-2 bg-black/10 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-shrink-0">
            <button
              onClick={() => handleSendMessage('Buy data')}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs whitespace-nowrap transition border border-white/20 backdrop-blur-sm flex items-center gap-1"
            >
              <Wifi className="h-3 w-3" /> Buy Data
            </button>
            <button
              onClick={() => handleSendMessage('Buy airtime')}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs whitespace-nowrap transition border border-white/20 backdrop-blur-sm flex items-center gap-1"
            >
              <Zap className="h-3 w-3" /> Buy Airtime
            </button>
            <button
              onClick={() => handleSendMessage('What is my balance?')}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs whitespace-nowrap transition border border-white/20 backdrop-blur-sm flex items-center gap-1"
            >
              <CreditCard className="h-3 w-3" /> Balance
            </button>
            <button
              onClick={() => handleSendMessage('Send ₦5,000 to Mum')}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs whitespace-nowrap transition border border-white/20 backdrop-blur-sm flex items-center gap-1"
            >
              Send ₦5k
            </button>
            <button
              onClick={() => handleSendMessage('Gift')}
              className="px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs whitespace-nowrap transition border border-white/20 backdrop-blur-sm flex items-center gap-1"
            >
              <Gift className="h-3 w-3" /> Gift
            </button>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(input);
            }}
            className="p-3.5 bg-black/20 backdrop-blur-md border-t border-white/10 flex items-center gap-2.5 flex-shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type 'buy data', 'balance', or tap an option..."
              className="flex-1 bg-white/95 text-[#2c2854] placeholder-slate-400 rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white shadow-inner font-medium"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-11 w-11 rounded-full bg-white hover:bg-white/90 text-[#5855f4] flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:scale-105 active:scale-95 flex-shrink-0 font-bold"
            >
              <Send className="h-4 w-4 fill-current ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
