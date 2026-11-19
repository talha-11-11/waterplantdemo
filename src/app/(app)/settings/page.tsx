import { logout, sendSummaryAction } from "@/app/actions";
import RunButton from "@/components/RunButton";
import SettingsForm from "@/components/SettingsForm";
import Link from "next/link";
import { ChangePasswordForm } from "@/components/UserForms";
import ResetDemo from "@/components/ResetDemo";
import { getSettings } from "@/lib/data";
import { pageUser } from "@/lib/session";
import { dayOf, monthOf, periodLabel, pkToday, prevMonth } from "@/lib/dates";
import { TEMPLATE_BILL, TEMPLATE_SUMMARY, waMode } from "@/lib/whatsapp";

export default async function SettingsPage() {
  const [user, s] = await Promise.all([pageUser(), getSettings()]);
  const today = pkToday();
  const m = monthOf(today);
  const mode = waMode();
  // Most recent finished 10-day block, for a manual re-send
  const day = dayOf(today);
  const block = day > 20 ? { from: `${m}-11`, to: `${m}-20` }
    : day > 10 ? { from: `${m}-01`, to: `${m}-10` }
    : { from: `${prevMonth(m)}-11`, to: `${prevMonth(m)}-20` };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsForm s={s} />

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">WhatsApp</h2>
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          Free mode: when you tap <b>Deliver</b>, WhatsApp opens with the customer&apos;s message ready. Tap send. Monthly bills work the same way from the Bills page.
        </p>
        {mode === "live" ? (
          <>
            <p className="text-sm text-slate-700">WhatsApp API is also connected (paid). It sends automatically:</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>11th, 8 AM: summary of days 1–10 (template <code>{TEMPLATE_SUMMARY()}</code>)</li>
              <li>21st, 8 AM: summary of days 11–20</li>
              <li>1st, 8 AM: monthly bill as PDF (template <code>{TEMPLATE_BILL()}</code>)</li>
            </ul>
            <RunButton action={sendSummaryAction} fields={block}
              label={`Send ${periodLabel(block.from, block.to)} summary now`}
              confirmText="Yes, send this summary to customers" />
          </>
        ) : (
          <p className="text-sm text-slate-600">Optional upgrade: add WhatsApp API keys on the server to send 10-day summaries and bills automatically (paid per message).</p>
        )}
      </section>

      {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && <ResetDemo />}

      <Link href="/backups" className="card flex items-center justify-between p-4 font-semibold text-brand hover:bg-slate-50">
        Backups &amp; restore a previous day <span aria-hidden="true">›</span>
      </Link>

      {user.role === "superadmin" && (
        <Link href="/users" className="card flex items-center justify-between p-4 font-semibold text-brand hover:bg-slate-50">
          Manage logins (super admin) <span aria-hidden="true">›</span>
        </Link>
      )}

      <ChangePasswordForm />

      <form action={logout}>
        <button className="btn-outline w-full">Log out ({user.username})</button>
      </form>
    </div>
  );
}
