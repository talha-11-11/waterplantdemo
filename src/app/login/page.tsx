"use client";

import Image from "next/image";
import { useActionState } from "react";
import { login } from "../actions";
import { ChatIcon } from "@/components/icons";

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-brand px-6 py-8">
      <form action={action} className="card w-full max-w-sm space-y-5 p-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo.png" alt="" width={96} height={96} priority />
          <h1 className="text-xl font-bold">Water Plant Demo</h1>
          {DEMO && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Live demo</span>}
        </div>
        {DEMO && (
          <div className="rounded-xl bg-brand-tint p-3 text-sm">
            <p>Try it: username <b>demo</b>, password <b>demo123</b></p>
            <button type="button" className="mt-2 font-semibold text-brand underline underline-offset-4"
              onClick={() => {
                (document.getElementById("username") as HTMLInputElement).value = "demo";
                (document.getElementById("password") as HTMLInputElement).value = "demo123";
              }}>
              Fill in demo login
            </button>
          </div>
        )}
        <div>
          <label htmlFor="username" className="label">Username</label>
          <input id="username" name="username" required autoFocus className="input" autoCapitalize="none" autoCorrect="off" autoComplete="username" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
        </div>
        {state?.error && <p className="text-sm font-medium text-red-700" role="alert">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>{pending ? "Checking…" : "Log in"}</button>
      </form>
      <footer className="mt-6 flex w-full max-w-sm flex-col items-center gap-2 text-center text-white">
        <p className="text-xs font-medium text-brand-light">Powered by</p>
        <Image src="/pokitbio.png" alt="PokitBio" width={180} height={65} className="rounded-xl" />
        <a href="https://wa.me/923396886174" target="_blank" rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white hover:bg-brand-dark">
          <ChatIcon className="size-4" /> WhatsApp: +92 339 6886174
        </a>
        <a href="https://pokitbio.com" target="_blank" rel="noopener noreferrer"
          className="inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-white underline-offset-4 hover:bg-brand-dark hover:underline">
          pokitbio.com
        </a>
      </footer>
    </main>
  );
}
