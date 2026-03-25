"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LocationInput from "@/components/LocationInput";
import { addContact, getContacts } from "@/lib/storage";
import { getDefaultFollowUp } from "@/lib/utils";
import type { Contact, ContactKind, LocationKind, TemperatureKind, TierKind } from "@/lib/types";

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
const sectionLabelClass = "block text-sm text-slate-700";
const saveButtonBaseClass =
  "rounded-lg px-3 py-2 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70";
const surfaceClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

export default function AddContactPage() {
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [social, setSocial] = useState("");
  const [type, setType] = useState<ContactKind>("other");
  const [location, setLocation] = useState<LocationKind>("");
  const [temperature, setTemperature] = useState<TemperatureKind>("warm");
  const [tier, setTier] = useState<TierKind>("C");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        setContacts(await getContacts());
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = new Date();
    const trimmedName = name.trim();
    const manualFollowUp =
      followUpDate.trim().length > 0 ? new Date(`${followUpDate}T09:00:00`) : null;
    const nextFollowUp =
      manualFollowUp && !Number.isNaN(manualFollowUp.getTime())
        ? manualFollowUp
        : getDefaultFollowUp({
            name: trimmedName,
            type,
            temperature,
          });

    setSaveStatus("saving");

    try {
      await addContact({
        name: trimmedName,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        social: social.trim() || undefined,
        type,
        location,
        temperature,
        tier,
        nextFollowUp,
        lastContacted: now,
        notes: [],
      });

      setSaveStatus("success");
      window.setTimeout(() => {
        router.push("/");
      }, 700);
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <main className="max-w-3xl space-y-4">
      <section className={`${surfaceClass} px-4 py-3`}>
        <h1 className="text-lg font-semibold text-slate-900">Add Contact</h1>
        <p className="mt-1 text-sm text-slate-500">Create and organize a new contact.</p>
      </section>

      <section className={`${surfaceClass} p-4 sm:p-5`}>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className={sectionLabelClass} htmlFor="name">
              Name
            </label>
            <input
              className={inputClass}
              id="name"
              onChange={(event) => {
                setSaveStatus((current) => (current === "success" ? "idle" : current));
                setName(event.target.value);
              }}
              placeholder="John Smith"
              required
              value={name}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={sectionLabelClass} htmlFor="type">
                Type
              </label>
              <select
                className={inputClass}
                id="type"
                onChange={(event) => {
                  setSaveStatus((current) => (current === "success" ? "idle" : current));
                  setType(event.target.value as ContactKind);
                }}
                value={type}
              >
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="investor">Investor</option>
                <option value="renter">Renter</option>
                <option value="lender">Lender</option>
                <option value="inspector">Inspector</option>
                <option value="agent">Agent</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className={sectionLabelClass} htmlFor="location">
                Location
              </label>
              <div className="mt-1">
                <LocationInput
                  contacts={contacts}
                  onChange={(nextValue) => {
                    setSaveStatus((current) => (current === "success" ? "idle" : current));
                    setLocation(nextValue as LocationKind);
                  }}
                  onCommit={(nextValue) => {
                    setSaveStatus((current) => (current === "success" ? "idle" : current));
                    setLocation(nextValue as LocationKind);
                  }}
                  value={location}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={sectionLabelClass} htmlFor="temperature">
                Temperature
              </label>
              <select
                className={inputClass}
                id="temperature"
                onChange={(event) => {
                  setSaveStatus((current) => (current === "success" ? "idle" : current));
                  setTemperature(event.target.value as TemperatureKind);
                }}
                value={temperature}
              >
                <option value="cold">cold</option>
                <option value="warm">warm</option>
                <option value="hot">hot</option>
              </select>
            </div>

            <div>
              <label className={sectionLabelClass} htmlFor="tier">
                Tier
              </label>
              <select
                className={inputClass}
                id="tier"
                onChange={(event) => {
                  setSaveStatus((current) => (current === "success" ? "idle" : current));
                  setTier(event.target.value as TierKind);
                }}
                value={tier}
              >
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
                <option value="D">D Tier</option>
              </select>
            </div>
          </div>

          <div>
            <label className={sectionLabelClass} htmlFor="follow-up-date">
              Follow-up date
            </label>
            <input
              className={inputClass}
              id="follow-up-date"
              onChange={(event) => {
                setSaveStatus((current) => (current === "success" ? "idle" : current));
                setFollowUpDate(event.target.value);
              }}
              type="date"
              value={followUpDate}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={sectionLabelClass} htmlFor="phone">
                Phone
              </label>
              <input
                className={inputClass}
                id="phone"
                onChange={(event) => {
                  setSaveStatus((current) => (current === "success" ? "idle" : current));
                  setPhone(event.target.value);
                }}
                type="tel"
                value={phone}
              />
            </div>

            <div>
              <label className={sectionLabelClass} htmlFor="email">
                Email
              </label>
              <input
                className={inputClass}
                id="email"
                onChange={(event) => {
                  setSaveStatus((current) => (current === "success" ? "idle" : current));
                  setEmail(event.target.value);
                }}
                type="email"
                value={email}
              />
            </div>
          </div>

          <div>
            <label className={sectionLabelClass} htmlFor="social">
              Social
            </label>
            <input
              className={inputClass}
              id="social"
              onChange={(event) => {
                setSaveStatus((current) => (current === "success" ? "idle" : current));
                setSocial(event.target.value);
              }}
              placeholder="https://instagram.com/..."
              value={social}
            />
          </div>

          <button
            className={
              saveStatus === "success"
                ? `${saveButtonBaseClass} bg-emerald-600`
                : saveStatus === "error"
                  ? `${saveButtonBaseClass} bg-red-600`
                  : `${saveButtonBaseClass} bg-slate-900 hover:bg-slate-800`
            }
            disabled={saveStatus === "saving"}
            type="submit"
          >
            <span className="inline-flex items-center gap-2">
              {saveStatus === "saving" ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : null}
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "success"
                  ? "Saved ✓"
                  : saveStatus === "error"
                    ? "Error saving"
                    : "Save Contact"}
            </span>
          </button>
        </form>
      </section>
    </main>
  );
}
