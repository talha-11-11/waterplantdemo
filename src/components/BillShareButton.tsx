"use client";

import { useState } from "react";
import { markBillSent } from "@/app/actions";
import { ChatIcon } from "./icons";

/** Opens the owner's WhatsApp with the bill message, and marks the bill as sent. */
export default function BillShareButton({ billId, href, sent }: { billId: number; href: string; sent: boolean }) {
  const [done, setDone] = useState(sent);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => { setDone(true); markBillSent(billId).catch(() => setDone(sent)); }}
      className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-semibold ${done ? "border border-slate-300 bg-white text-slate-700" : "bg-brand text-white"}`}
    >
      <ChatIcon className="size-4" /> {done ? "Sent" : "Send"}
    </a>
  );
}
