"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.25)]";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function resetStatus() {
    setStatus("idle");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setErrorMessage("");
    setSuccessMessage("");

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setStatus("error");
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace("/contacts");
        return;
      }

      setStatus("success");
      setSuccessMessage("Account created, but Supabase did not return a session. For development, disable email confirmation in Supabase Auth settings and try again.");
      return;
    }

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
        <h1 className="text-lg font-semibold text-slate-900">{mode === "signup" ? "Create Account" : "Login"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "signup" ? "Create an account to access the CRM." : "Sign in to access the CRM."}
        </p>

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
                setStatus((current) => (current === "error" || current === "success" ? "idle" : current));
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
                setStatus((current) => (current === "error" || current === "success" ? "idle" : current));
                setPassword(event.target.value);
              }}
              type="password"
              value={password}
            />
          </div>

          {status === "error" ? <p className="text-sm text-red-600">{errorMessage || "Unable to sign in."}</p> : null}
          {status === "success" ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

          <button
            className="rounded-lg bg-[#007AFF] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0066CC] disabled:cursor-not-allowed disabled:opacity-70"
            disabled={status === "loading"}
            type="submit"
          >
            {status === "loading" ? (mode === "signup" ? "Creating account..." : "Signing in...") : mode === "signup" ? "Create Account" : "Login"}
          </button>
        </form>

        <div className="mt-4 border-t border-slate-200 pt-4">
          <button
            className="text-sm font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
            onClick={() => {
              resetStatus();
              setMode((current) => (current === "signup" ? "login" : "signup"));
            }}
            type="button"
          >
            {mode === "signup" ? "Already have an account? Login" : "Create account"}
          </button>
        </div>
      </section>
    </main>
  );
}
