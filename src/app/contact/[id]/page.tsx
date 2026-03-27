"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import LocationInput from "@/components/LocationInput";
import { toDateInputValue } from "@/lib/date";
import { getContacts, updateContact } from "@/lib/storage";
import type {
  Contact,
  ContactKind,
  LocationKind,
  TemperatureKind,
  TierKind,
} from "@/lib/types";

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#eb0003] focus:ring-2 focus:ring-[#eb0003]/20";
const labelClass = "block text-sm text-slate-700";
const surfaceClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

type ContactFormState = {
  name: string;
  phone: string;
  email: string;
  social: string;
  type: ContactKind;
  location: LocationKind;
  temperature: TemperatureKind;
  tier: TierKind;
  nextFollowUp: string;
  lastContacted: string;
};

function toFormState(contact: Contact): ContactFormState {
  return {
    name: contact.name,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    social: contact.social ?? "",
    type: contact.type,
    location: contact.location,
    temperature: contact.temperature,
    tier: contact.tier,
    nextFollowUp: toDateInputValue(contact.nextFollowUp),
    lastContacted: toDateInputValue(contact.lastContacted),
  };
}

function isSameFormState(a: ContactFormState | null, b: ContactFormState | null): boolean {
  if (!a || !b) {
    return a === b;
  }

  return (
    a.name === b.name &&
    a.phone === b.phone &&
    a.email === b.email &&
    a.social === b.social &&
    a.type === b.type &&
    a.location === b.location &&
    a.temperature === b.temperature &&
    a.tier === b.tier &&
    a.nextFollowUp === b.nextFollowUp &&
    a.lastContacted === b.lastContacted
  );
}

type LeaveState =
  | { type: "href"; href: string }
  | { type: "history" };

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [loaded, setLoaded] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contact, setContact] = useState<Contact | null>(null);
  const [formState, setFormState] = useState<ContactFormState | null>(null);
  const [initialFormState, setInitialFormState] = useState<ContactFormState | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [pendingLeave, setPendingLeave] = useState<LeaveState | null>(null);
  const [leaveActionStatus, setLeaveActionStatus] = useState<"idle" | "saving">("idle");
  const ignoreNavigationWarningRef = useRef(false);

  const hasUnsavedChanges = useMemo(() => !isSameFormState(formState, initialFormState), [formState, initialFormState]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const contacts = await getContacts();
        const found = contacts.find((item) => item.id === id) ?? null;
        setAllContacts(contacts);
        setContact(found);
        const nextFormState = found ? toFormState(found) : null;
        setFormState(nextFormState);
        setInitialFormState(nextFormState);
        setLoaded(true);
      })();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "You have unsaved changes. Are you sure you want to leave?";
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (ignoreNavigationWarningRef.current || !hasUnsavedChanges) {
        return;
      }

      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:")) {
        return;
      }

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      const nextPath = `${url.pathname}${url.search}${url.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) {
        return;
      }

      event.preventDefault();
      setPendingLeave({ type: "href", href: nextPath });
    };

    const handlePopState = () => {
      if (ignoreNavigationWarningRef.current || !hasUnsavedChanges) {
        return;
      }

      history.go(1);
      setPendingLeave({ type: "history" });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [hasUnsavedChanges]);

  if (!loaded) {
    return (
      <main className={`${surfaceClass} p-4`}>
        <p className="text-slate-700">Loading contact...</p>
      </main>
    );
  }

  if (!contact) {
    return (
      <main className={`${surfaceClass} p-4`}>
        <p className="text-slate-700">Contact not found.</p>
        <Link className="mt-3 inline-block text-sm text-slate-900 underline" href="/">
          Back to dashboard
        </Link>
      </main>
    );
  }

  async function saveDetails(): Promise<boolean> {
    if (!contact || !formState) {
      return false;
    }

    const nextFollowUp = new Date(`${formState.nextFollowUp}T09:00:00`);
    const lastContacted = new Date(`${formState.lastContacted}T09:00:00`);
    if (Number.isNaN(nextFollowUp.getTime()) || Number.isNaN(lastContacted.getTime())) {
      setSaveStatus("error");
      return false;
    }

    const updates: Partial<Contact> = {
      name: formState.name.trim(),
      phone: formState.phone.trim() || undefined,
      email: formState.email.trim() || undefined,
      social: formState.social.trim() || undefined,
      type: formState.type,
      location: formState.location,
      temperature: formState.temperature,
      tier: formState.tier,
      nextFollowUp,
      lastContacted,
    };

    setSaveStatus("saving");

    try {
      const updatedContact = await updateContact(contact.id, updates);
      setContact(updatedContact);
      const nextFormState = toFormState(updatedContact);
      setFormState(nextFormState);
      setInitialFormState(nextFormState);
      setSaveStatus("success");
      window.setTimeout(() => setSaveStatus("idle"), 1500);
      return true;
    } catch {
      setSaveStatus("error");
      return false;
    }
  }

  async function handleSaveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveDetails();
  }

  async function handleSaveAndContinue() {
    if (!pendingLeave || leaveActionStatus === "saving") {
      return;
    }

    setLeaveActionStatus("saving");
    const saved = await saveDetails();

    if (!saved) {
      setLeaveActionStatus("idle");
      return;
    }

    ignoreNavigationWarningRef.current = true;
    const nextLeave = pendingLeave;
    setPendingLeave(null);
    setLeaveActionStatus("idle");

    window.setTimeout(() => {
      if (nextLeave.type === "href") {
        router.push(nextLeave.href);
      } else {
        history.back();
      }
    }, 0);
  }

  async function handleAddNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!contact) {
      return;
    }

    const formData = new FormData(form);
    const text = String(formData.get("noteText") ?? "").trim();
    if (!text) {
      return;
    }

    const updatedContact = {
      notes: [...contact.notes, { text, date: new Date() }],
    };

    const saved = await updateContact(contact.id, updatedContact);
    setContact(saved);
    setFormState(toFormState(saved));
    form.reset();
  }

  const sortedNotes = [...contact.notes].sort((a, b) => b.date.getTime() - a.date.getTime());

  function markEditing() {
    setSaveStatus((current) => (current === "success" ? "idle" : current));
  }

  function handleLeaveConfirm() {
    if (!pendingLeave) {
      return;
    }

    ignoreNavigationWarningRef.current = true;
    const nextLeave = pendingLeave;
    setPendingLeave(null);
    setLeaveActionStatus("idle");

    window.setTimeout(() => {
      if (nextLeave.type === "href") {
        router.push(nextLeave.href);
      } else {
        history.back();
      }
    }, 0);
  }

  return (
    <main className="space-y-4">
      <section className={`${surfaceClass} px-4 py-3`}>
        <h1 className="text-lg font-semibold text-slate-900">{contact.name}</h1>
        <p className="mt-1 text-sm text-slate-500">Review and update this contact without leaving the CRM flow.</p>
      </section>

      <section className={`${surfaceClass} p-4`}>
        <h2 className="text-lg font-semibold text-slate-900">Contact Details</h2>
        {hasUnsavedChanges ? (
          <p className="mt-2 text-sm font-medium text-amber-600">Unsaved changes</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Changes save in place with immediate feedback.</p>
        )}
        <form className="mt-3 space-y-3" onSubmit={handleSaveDetails}>
          <div>
            <label className={labelClass} htmlFor="name">
              Name
            </label>
            <input
              className={inputClass}
              id="name"
              onChange={(event) => {
                markEditing();
                setFormState((current) => (current ? { ...current, name: event.target.value } : current));
              }}
              value={formState?.name ?? ""}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="phone">
                Phone
              </label>
              <input
                className={inputClass}
                id="phone"
                onChange={(event) => {
                  markEditing();
                  setFormState((current) => (current ? { ...current, phone: event.target.value } : current));
                }}
                value={formState?.phone ?? ""}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="email">
                Email
              </label>
              <input
                className={inputClass}
                id="email"
                onChange={(event) => {
                  markEditing();
                  setFormState((current) => (current ? { ...current, email: event.target.value } : current));
                }}
                type="email"
                value={formState?.email ?? ""}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="social">
              Social / DM URL
            </label>
            <input
              className={inputClass}
              id="social"
              onChange={(event) => {
                markEditing();
                setFormState((current) => (current ? { ...current, social: event.target.value } : current));
              }}
              value={formState?.social ?? ""}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="type">
                Type
              </label>
              <select
                className={inputClass}
                id="type"
                onChange={(event) =>
                  {
                    markEditing();
                    setFormState((current) =>
                      current ? { ...current, type: event.target.value as ContactKind } : current,
                    );
                  }
                }
                value={formState?.type ?? contact.type}
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
              <label className={labelClass} htmlFor="location">
                Location
              </label>
              <div className="mt-1">
                <LocationInput
                  contacts={allContacts}
                  excludeContactId={contact.id}
                  onChange={(nextValue) => {
                    markEditing();
                    setFormState((current) =>
                      current ? { ...current, location: nextValue as LocationKind } : current,
                    );
                  }}
                  onCommit={(nextValue) => {
                    markEditing();
                    setFormState((current) =>
                      current ? { ...current, location: nextValue as LocationKind } : current,
                    );
                  }}
                  value={formState?.location ?? contact.location}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="temperature">
                Temperature
              </label>
              <select
                className={inputClass}
                id="temperature"
                onChange={(event) =>
                  {
                    markEditing();
                    setFormState((current) =>
                      current ? { ...current, temperature: event.target.value as TemperatureKind } : current,
                    );
                  }
                }
                value={formState?.temperature ?? contact.temperature}
              >
                <option value="cold">cold</option>
                <option value="warm">warm</option>
                <option value="hot">hot</option>
              </select>
            </div>

            <div>
              <label className={labelClass} htmlFor="tier">
                Tier
              </label>
              <select
                className={inputClass}
                id="tier"
                onChange={(event) =>
                  {
                    markEditing();
                    setFormState((current) =>
                      current ? { ...current, tier: event.target.value as TierKind } : current,
                    );
                  }
                }
                value={formState?.tier ?? contact.tier}
              >
                <option value="A">A Tier</option>
                <option value="B">B Tier</option>
                <option value="C">C Tier</option>
                <option value="D">D Tier</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="follow-up-date">
                Next follow-up date
              </label>
              <input
                className={inputClass}
                id="follow-up-date"
                onChange={(event) => {
                  markEditing();
                  setFormState((current) => (current ? { ...current, nextFollowUp: event.target.value } : current));
                }}
                type="date"
                value={formState?.nextFollowUp ?? toDateInputValue(contact.nextFollowUp)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="last-contacted">
                Last contacted
              </label>
              <input
                className={inputClass}
                id="last-contacted"
                onChange={(event) => {
                  markEditing();
                  setFormState((current) => (current ? { ...current, lastContacted: event.target.value } : current));
                }}
                type="date"
                value={formState?.lastContacted ?? toDateInputValue(contact.lastContacted)}
              />
            </div>
          </div>

          <button
            className={
              saveStatus === "success"
                ? "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                : saveStatus === "error"
                  ? "rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                  : "rounded-lg bg-[#eb0003] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#c40003]"
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
                    : "Save"}
            </span>
          </button>
        </form>
      </section>

      <section className={`${surfaceClass} p-4`}>
        <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
        <p className="mt-1 text-sm text-slate-500">Capture context so the next touchpoint starts with the right information.</p>

        <form className="mt-3 flex flex-col gap-2" onSubmit={handleAddNote}>
          <textarea
            className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#eb0003] focus:ring-2 focus:ring-[#eb0003]/20"
            name="noteText"
            placeholder="Add note"
          />
          <button
            className="self-start rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            type="submit"
          >
            Add note
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {sortedNotes.length === 0 ? (
            <p className="text-sm text-slate-600">No notes yet.</p>
          ) : (
            sortedNotes.map((note, index) => (
              <article className="rounded-xl border border-slate-200 p-3" key={`${note.date.toISOString()}-${index}`}>
                <p className="text-sm text-slate-800">{note.text}</p>
                <p className="mt-1 text-xs text-slate-500">{note.date.toLocaleString()}</p>
              </article>
            ))
          )}
        </div>
      </section>

      {pendingLeave ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="crm-fade-up w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Unsaved Changes</h2>
            <p className="mt-2 text-sm text-slate-600">You have unsaved changes. What would you like to do?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={leaveActionStatus === "saving"}
                onClick={() => {
                  setPendingLeave(null);
                  setLeaveActionStatus("idle");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={leaveActionStatus === "saving"}
                onClick={handleLeaveConfirm}
                type="button"
              >
                Leave Without Saving
              </button>
              <button
                className="rounded-lg bg-[#eb0003] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#c40003] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={leaveActionStatus === "saving" || saveStatus === "saving"}
                onClick={() => void handleSaveAndContinue()}
                type="button"
              >
                {leaveActionStatus === "saving" ? "Saving..." : "Save & Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
