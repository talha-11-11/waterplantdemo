"use client";

import { useActionState } from "react";
import { createItem } from "@/app/actions";

export default function NewItemForm() {
  const [state, action, pending] = useActionState(createItem, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold">Add stock item</h2>
      <div>
        <label htmlFor="ni-name" className="label">Item name</label>
        <input id="ni-name" name="name" required className="input" placeholder="e.g. Caps, Shrink sleeves, Filter cartridge" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="ni-unit" className="label">Unit</label>
          <input id="ni-unit" name="unit" defaultValue="pcs" className="input" />
        </div>
        <div>
          <label htmlFor="ni-opening" className="label">Stock now</label>
          <input id="ni-opening" name="opening" type="number" min={0} defaultValue={0} className="input" />
        </div>
        <div>
          <label htmlFor="ni-low" className="label">Low at</label>
          <input id="ni-low" name="lowAt" type="number" min={0} defaultValue={0} className="input" />
        </div>
      </div>
      <div>
        <label htmlFor="ni-link" className="label">Goes down automatically with deliveries?</label>
        <select id="ni-link" name="linkedTo" className="input" defaultValue="">
          <option value="">No, I enter stock out myself</option>
          <option value="std">Yes, with every standard can delivered</option>
          <option value="disp">Yes, with every dispenser can delivered</option>
        </select>
      </div>
      {state?.error && <p className="text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-700" role="status">Item added.</p>}
      <button className="btn-primary w-full" disabled={pending}>Add item</button>
    </form>
  );
}
