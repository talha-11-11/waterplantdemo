import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { deleteCustomer } from "@/app/actions";
import CustomerForm from "@/components/CustomerForm";
import { BackIcon } from "@/components/icons";
import { getSettings, societies } from "@/lib/data";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const [[c], s, socs] = await Promise.all([
    db.select().from(schema.customers).where(eq(schema.customers.id, id)),
    getSettings(),
    societies(),
  ]);
  if (!c) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/customers/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand"><BackIcon /> {c.name}</Link>
      <h1 className="text-2xl font-bold">Edit customer</h1>
      <CustomerForm customer={c} societies={socs} defaults={{ priceStd: s.priceStd, priceDisp: s.priceDisp }} />
      <form action={deleteCustomer} className="card p-4">
        <input type="hidden" name="id" value={c.id} />
        <p className="mb-3 text-sm text-slate-600">Deleting removes all deliveries, payments and bills of this customer. To stop deliveries but keep history, untick “Active” instead.</p>
        <label className="mb-3 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" required className="size-5" /> Yes, delete {c.name} and all history
        </label>
        <button className="btn-danger w-full">Delete customer permanently</button>
      </form>
    </div>
  );
}
