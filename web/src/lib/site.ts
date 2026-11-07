export const WHATSAPP_NUMBER = "2348000000000"; // TODO: replace with live WappPay business number

export const WHATSAPP_URL = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent("Hi WappPay")}`;

export const NAV_LINKS = [
  { label: "Services", href: "#services" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
] as const;

export const PROCESSED_NAIRA = 2_847_500_000;
