"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }

    router.replace("/contacts");
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-md items-center justify-center">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Login</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to access the CRM.</p>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className={inputClass}
              id="email"
              onChange={(event) => {
                setStatus((current) => (current === "error" ? "idle" : current));
                setEmail(event.target.value);
              }}
              type="email"
              value={email}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className={inputClass}
              id="password"
              onChange={(event) => {
                setStatus((current) => (current === "error" ? "idle" : current));
                setPassword(event.target.value);
              }}
              type="password"
              value={password}
            />
          </div>

          {status === "error" ? <p className="text-sm text-red-600">{errorMessage || "Unable to sign in."}</p> : null}

          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status === "loading"}
            type="submit"
          >
            {status === "loading" ? "Signing in..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
