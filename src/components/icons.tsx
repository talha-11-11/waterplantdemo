type P = { className?: string };
const base = {
  fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true,
};

export const RouteIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const UsersIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>
);
export const CashIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v5M18 9.5v5" /></svg>
);
export const BillIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}><path d="M6 2.5h9l4 4V21.5H6z" /><path d="M14.5 2.5v4.5h4.5M9 12h7M9 16h7" /></svg>
);
export const ChartIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
export const GearIcon = ({ className = "size-6" }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
);
export const CheckIcon = ({ className = "size-4" }: P) => (
  <svg {...base} strokeWidth={3} className={className}><path d="M5 12l5 5L20 7" /></svg>
);
export const ChatIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}><path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" /></svg>
);
export const PlusIcon = ({ className = "size-4" }: P) => (
  <svg {...base} strokeWidth={2.5} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const BackIcon = ({ className = "size-5" }: P) => (
  <svg {...base} className={className}><path d="M15 18l-6-6 6-6" /></svg>
);
