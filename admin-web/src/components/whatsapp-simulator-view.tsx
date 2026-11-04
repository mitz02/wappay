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
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  options?: Array<{ id: string; label: string; sub?: string; icon?: string }>;
  isDataOptions?: boolean;
  isReceipt?: boolean;
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
      text: 'Welcome to WAPPay! 🚀\nI am your conversational financial assistant. You can check balances, transfer funds, buy instant airtime & internet data, or send gifts!',
      timestamp: '12:33 PM',
      options: [
        { id: 'buy data', label: '🌐 Buy Data Bundle', sub: 'Instant 4G/5G' },
        { id: 'buy airtime', label: '⚡ Buy Airtime', sub: '3% Cashback' },
        { id: 'balance', label: '💰 Check Balance', sub: 'Wallet Balance' },
        { id: 'gift', label: '🎁 Gift Shop', sub: 'Send a Surprise' },
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

  // Extract clickable button options from bot responses
  const extractInteractiveButtons = (
    text: string,
  ): Array<{ id: string; label: string; sub?: string; icon?: string }> | undefined => {
    if (text.includes('SELECT DATA NETWORK') || text.includes('SELECT MOBILE NETWORK FOR DATA')) {
      return [
        { id: 'MTN', label: '🟡 MTN Nigeria', sub: 'Instant 4G/5G • 3% Cashback', icon: '🟡' },
        { id: 'AIRTEL', label: '🔴 Airtel Nigeria', sub: 'Smart Speed • 3% Cashback', icon: '🔴' },
        { id: 'GLO', label: '🟢 Glo Nigeria', sub: 'Unlimited Grand • 3% Cashback', icon: '🟢' },
        { id: '9MOBILE', label: '🟢 9mobile', sub: 'Super Fast Data • 3% Cashback', icon: '🟢' },
      ];
    }

    if (text.includes('SELECT DATA PLAN')) {
      const isAirtel = text.includes('Airtel');
      const isGlo = text.includes('Glo');
      const is9mobile = text.includes('9mobile');

      if (isAirtel) {
        return [
          { id: '1GB', label: '1GB (1 Day)', sub: '₦350 • 3% Cashback' },
          { id: '2GB', label: '2GB (2 Days)', sub: '₦600 • 3% Cashback' },
          { id: '5GB', label: '5GB (Weekly)', sub: '₦1,500 • 3% Cashback' },
          { id: '10GB', label: '10GB (Monthly)', sub: '₦3,000 • 3% Cashback' },
          { id: '20GB', label: '20GB (Monthly)', sub: '₦5,000 • 3% Cashback' },
        ];
      }
      if (isGlo) {
        return [
          { id: '1.25GB', label: '1.25GB (1 Day)', sub: '₦350 • 3% Cashback' },
          { id: '2.5GB', label: '2.5GB (2 Days)', sub: '₦600 • 3% Cashback' },
          { id: '5.8GB', label: '5.8GB (Weekly)', sub: '₦1,500 • 3% Cashback' },
          { id: '10GB', label: '10GB (Monthly)', sub: '₦3,000 • 3% Cashback' },
          { id: '18GB', label: '18GB (Monthly)', sub: '₦5,000 • 3% Cashback' },
        ];
      }
      if (is9mobile) {
        return [
          { id: '1GB', label: '1GB (1 Day)', sub: '₦350 • 3% Cashback' },
          { id: '2.5GB', label: '2.5GB (2 Days)', sub: '₦600 • 3% Cashback' },
          { id: '5GB', label: '5GB (Weekly)', sub: '₦1,500 • 3% Cashback' },
          { id: '11GB', label: '11GB (Monthly)', sub: '₦3,000 • 3% Cashback' },
          { id: '20GB', label: '20GB (Monthly)', sub: '₦5,000 • 3% Cashback' },
        ];
      }
      // MTN default
      return [
        { id: '1GB', label: '1GB (1 Day)', sub: '₦350 • 3% Cashback' },
        { id: '2.5GB', label: '2.5GB (2 Days)', sub: '₦600 • 3% Cashback' },
        { id: '5GB', label: '5GB (Weekly)', sub: '₦1,500 • 3% Cashback' },
        { id: '10GB', label: '10GB (Monthly)', sub: '₦3,000 • 3% Cashback' },
        { id: '20GB', label: '20GB (Monthly)', sub: '₦5,000 • 3% Cashback' },
      ];
    }

    if (text.includes('SELECT MOBILE NETWORK') || text.includes('Instant Mobile Airtime Top-Up')) {
      return [
        { id: 'MTN', label: '🟡 MTN Nigeria', sub: '3% Cashback', icon: '🟡' },
        { id: 'AIRTEL', label: '🔴 Airtel Nigeria', sub: '3% Cashback', icon: '🔴' },
        { id: 'GLO', label: '🟢 Glo Nigeria', sub: '3% Cashback', icon: '🟢' },
        { id: '9MOBILE', label: '🟢 9mobile', sub: '3% Cashback', icon: '🟢' },
      ];
    }

    if (text.includes('SELECT AIRTIME AMOUNT')) {
      return [
        { id: '500', label: '₦500 Airtime', sub: 'Pay ₦485 (Save ₦15)' },
        { id: '1000', label: '₦1,000 Airtime', sub: 'Pay ₦970 (Save ₦30)' },
        { id: '2000', label: '₦2,000 Airtime', sub: 'Pay ₦1,940 (Save ₦60)' },
        { id: '5000', label: '₦5,000 Airtime', sub: 'Pay ₦4,850 (Save ₦150)' },
      ];
    }

    if (text.includes('SELECT GIFT TO SEND')) {
      return [
        { id: '1', label: 'Starter Airtime (₦1k)', sub: 'Delivered via WhatsApp' },
        { id: '4', label: 'Starter Data (1.5GB)', sub: '₦1,000 • Instant Claim' },
        { id: '7', label: 'Starter Money (₦1k)', sub: 'Cash to Wallet' },
        { id: '5', label: 'Deluxe Data (6GB)', sub: '₦4,000' },
      ];
    }

    if (text.includes('Reply *YES* to confirm') || text.includes('Simulated Transfer Confirmation')) {
      return [
        { id: 'YES', label: '✅ Confirm Transfer', sub: 'Execute simulated debit' },
        { id: 'CANCEL', label: '❌ Cancel Transfer', sub: 'Abort transaction' },
      ];
    }

    return undefined;
  };

  const handleSendMessage = async (rawText: string) => {
    const textToSend = rawText.trim();
    if (!textToSend || loading) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append outgoing user message
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
      // 1. Try hitting the local NestJS simulator API
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
        const options = extractInteractiveButtons(replyText);

        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            options,
          },
        ]);
        setLoading(false);
        return;
      }
    } catch {
      // Fallback to client-side simulated interactive assistant if server offline
    }

    // Client-side fallback conversational state engine for seamless testing
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
          `Please choose your mobile network:`;
      } else if (['mtn', 'airtel', 'glo', '9mobile'].includes(lower)) {
        const net = textToSend.toUpperCase();
        reply =
          `╔═══════════════════════════════════════╗\n` +
          `║          🌐 SELECT DATA PLAN          ║\n` +
          `╚═══════════════════════════════════════╝\n\n` +
          `🟡 *Network:* *${net} Nigeria*\n` +
          `📱 *Recipient:* \`${selectedPhone}\`\n` +
          `🎁 *Bonus:* 3% Instant Cashback\n\n` +
          `Choose a data package (clickable buttons below):`;
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
          `• *Plan:* *${textToSend.toUpperCase()} High-Speed Data*\n` +
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

      const options = extractInteractiveButtons(reply);

      setMessages((prev) => [
        ...prev,
        {
          id: `bot_${Date.now()}`,
          sender: 'bot',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options,
        },
      ]);
      setLoading(false);
    }, 600);
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
        text: 'Welcome to WAPPay! 🚀\nI can help you buy mobile data, airtime, transfer money, check balances, or send gifts. Tap an option below to test:',
        timestamp: '12:33 PM',
        options: [
          { id: 'buy data', label: '🌐 Buy Data Bundle', sub: 'Instant 4G/5G' },
          { id: 'buy airtime', label: '⚡ Buy Airtime', sub: '3% Cashback' },
          { id: 'balance', label: '💰 Check Balance', sub: 'Wallet Balance' },
          { id: 'gift', label: '🎁 Gift Shop', sub: 'Send a Gift' },
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
              <h2 className="text-sm font-semibold text-white">WhatsApp Chat Boxes UI Simulator</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                Exact Layout
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Matches your periwinkle-purple layout with clickable button options for network & data.
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
            title="Toggle between phone mockup and expanded full view"
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
              ? 'w-full max-w-[460px] rounded-3xl border-[6px] border-slate-800 ring-1 ring-slate-700'
              : 'w-full rounded-2xl border border-slate-800'
          }`}
          style={{
            // EXACT Background matching the screenshot: vibrant blue-violet / purple
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
                    className={`max-w-[85%] text-[14.5px] leading-relaxed transition shadow-sm ${
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
                    <div className="mt-2.5 w-full max-w-[85%] space-y-1.5 animate-in slide-in-from-bottom-2 duration-300">
                      <p className="text-[11px] font-semibold tracking-wider uppercase text-white/70 px-1 mb-1 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-amber-300" /> Click to Choose:
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
                        {msg.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => handleSendMessage(opt.id)}
                            className="w-full text-left bg-white/95 hover:bg-white text-[#2a2652] hover:text-indigo-900 rounded-2xl px-4 py-2.5 shadow-sm transition hover:scale-[1.01] active:scale-[0.99] border border-white/40 flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2.5">
                              {opt.icon && <span className="text-base">{opt.icon}</span>}
                              <div>
                                <p className="font-semibold text-xs text-[#2a2652] group-hover:text-indigo-900">
                                  {opt.label}
                                </p>
                                {opt.sub && (
                                  <p className="text-[11px] text-slate-500 group-hover:text-slate-700">
                                    {opt.sub}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                          </button>
                        ))}
                      </div>
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
