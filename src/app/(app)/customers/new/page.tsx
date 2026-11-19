import Link from "next/link";
import CustomerForm from "@/components/CustomerForm";
import { BackIcon } from "@/components/icons";
import { getSettings, societies } from "@/lib/data";

export default async function NewCustomerPage() {
  const [s, socs] = await Promise.all([getSettings(), societies()]);
  return (
    <div className="space-y-4">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><BackIcon /> Customers</Link>
      <h1 className="text-2xl font-bold">New customer</h1>
      <CustomerForm societies={socs} defaults={{ priceStd: s.priceStd, priceDisp: s.priceDisp }} />
    </div>
  );
}
