"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LocationInput, { standardizeLocation } from "@/components/LocationInput";
import { addDays, isOverdue } from "@/lib/date";
import { deleteContact, getContacts, updateContact } from "@/lib/storage";
import type { Contact, ContactKind, TemperatureKind, TierKind } from "@/lib/types";

function byNextFollowUp(a: Contact, b: Contact): number {
  return a.nextFollowUp.getTime() - b.nextFollowUp.getTime();
}

function daysSince(date: Date): number {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

function daysUntil(date: Date): number {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const tierRank = { A: 0, B: 1, C: 2, D: 3 } as const;
const typeFilters: Array<{ label: string; value: ContactKind }> = [
  { label: "Buyer", value: "buyer" },
  { label: "Seller", value: "seller" },
  { label: "Investor", value: "investor" },
  { label: "Renter", value: "renter" },
  { label: "Lender", value: "lender" },
  { label: "Inspector", value: "inspector" },
  { label: "Agent", value: "agent" },
  { label: "Other", value: "other" },
];

type ActionFlash = {
  contactId: string;
  action: "call" | "text";
};

type EditableField = "type" | "temperature" | "tier" | "location" | "phone" | "email";

type EditingCell = {
  contactId: string;
  field: EditableField;
};

type LogModalState =
  | {
      type: "log";
      contact: Contact;
      customDate: string;
      isSaving: boolean;
      showInvalidDate: boolean;
      step: "confirm" | "schedule";
    }
  | {
      type: "delete";
      contact: Contact;
      isDeleting: boolean;
      step: "confirm" | "danger";
    };

export default function ContactsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const typeFilter = searchParams.get("type");
  const tierFilter = searchParams.get("tier");
  const locationFilter = searchParams.get("location");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [copiedContactId, setCopiedContactId] = useState<string | null>(null);
  const [modalState, setModalState] = useState<LogModalState | null>(null);
  const [search, setSearch] = useState("");
  const [flashedAction, setFlashedAction] = useState<ActionFlash | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellStatus, setCellStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const copyResetTimerRef = useRef<number | null>(null);
  const actionFlashTimerRef = useRef<number | null>(null);
  const contactsRef = useRef<Contact[]>([]);
  const saveTimersRef = useRef<Record<string, number>>({});
  const statusTimersRef = useRef<Record<string, number>>({});
  const committedValuesRef = useRef<Record<string, string>>({});

  function getCellKey(contactId: string, field: EditableField): string {
    return `${contactId}:${field}`;
  }

  function getFieldValue(contact: Contact, field: EditableField): string {
    switch (field) {
      case "type":
        return contact.type;
      case "temperature":
        return contact.temperature;
      case "tier":
        return contact.tier;
      case "location":
        return contact.location;
      case "phone":
        return contact.phone ?? "";
      case "email":
        return contact.email ?? "";
    }
  }

  const refreshContacts = useCallback(async () => {
    const loaded = (await getContacts()).sort(byNextFollowUp);
    contactsRef.current = loaded;
    for (const contact of loaded) {
      for (const field of ["type", "temperature", "tier", "location", "phone", "email"] as EditableField[]) {
        committedValuesRef.current[`${contact.id}:${field}`] = getFieldValue(contact, field);
      }
    }
    setContacts(loaded);
  }, []);

  useEffect(() => {
    const refreshSoon = () => {
      window.setTimeout(() => {
        void refreshContacts();
      }, 0);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshSoon();
      }
    };

    refreshSoon();
    window.addEventListener("crm-engine:contacts-updated", refreshSoon);
    window.addEventListener("focus", refreshSoon);
    window.addEventListener("pageshow", refreshSoon);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("crm-engine:contacts-updated", refreshSoon);
      window.removeEventListener("focus", refreshSoon);
      window.removeEventListener("pageshow", refreshSoon);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshContacts]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    const saveTimers = saveTimersRef.current;
    const statusTimers = statusTimersRef.current;

    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      if (actionFlashTimerRef.current !== null) {
        window.clearTimeout(actionFlashTimerRef.current);
      }
      for (const timer of Object.values(saveTimers)) {
        window.clearTimeout(timer);
      }
      for (const timer of Object.values(statusTimers)) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  function setFieldStatus(contactId: string, field: EditableField, status: "idle" | "saving" | "saved" | "error") {
    const key = getCellKey(contactId, field);
    setCellStatus((current) => ({ ...current, [key]: status }));

    if (statusTimersRef.current[key]) {
      window.clearTimeout(statusTimersRef.current[key]);
      delete statusTimersRef.current[key];
    }

    if (status === "saved" || status === "error") {
      statusTimersRef.current[key] = window.setTimeout(() => {
        setCellStatus((current) => ({ ...current, [key]: "idle" }));
        delete statusTimersRef.current[key];
      }, 1200);
    }
  }

  function updateLocalContact(contactId: string, field: EditableField, value: string) {
    setContacts((current) => {
      const next = current.map((contact) => {
        if (contact.id !== contactId) {
          return contact;
        }

        if (field === "phone") {
          return { ...contact, phone: value || undefined };
        }

        if (field === "email") {
          return { ...contact, email: value || undefined };
        }

        if (field === "type") {
          return { ...contact, type: value as ContactKind };
        }

        if (field === "temperature") {
          return { ...contact, temperature: value as TemperatureKind };
        }

        if (field === "tier") {
          return { ...contact, tier: value as TierKind };
        }

        return { ...contact, location: value };
      });

      contactsRef.current = next;
      return next;
    });
  }

  function revertLocalContact(contactId: string, field: EditableField) {
    const committed = committedValuesRef.current[getCellKey(contactId, field)] ?? "";
    updateLocalContact(contactId, field, committed);
  }

  function toUpdatePayload(field: EditableField, value: string): Partial<Contact> {
    if (field === "phone") {
      return { phone: value || undefined };
    }

    if (field === "email") {
      return { email: value || undefined };
    }

    if (field === "type") {
      return { type: value as ContactKind };
    }

    if (field === "temperature") {
      return { temperature: value as TemperatureKind };
    }

    if (field === "tier") {
      return { tier: value as TierKind };
    }

    return { location: value };
  }

  async function persistField(contactId: string, field: EditableField) {
    const contact = contactsRef.current.find((item) => item.id === contactId);
    if (!contact) {
      return;
    }

    const key = getCellKey(contactId, field);
    const value = getFieldValue(contact, field);
    const committed = committedValuesRef.current[key] ?? "";

    if (value === committed) {
      setFieldStatus(contactId, field, "idle");
      return;
    }

    setFieldStatus(contactId, field, "saving");

    try {
      await updateContact(contactId, toUpdatePayload(field, value));
      committedValuesRef.current[key] = value;
      setFieldStatus(contactId, field, "saved");
    } catch {
      revertLocalContact(contactId, field);
      setFieldStatus(contactId, field, "error");
    }
  }

  function scheduleFieldSave(contactId: string, field: EditableField) {
    const key = getCellKey(contactId, field);
    if (saveTimersRef.current[key]) {
      window.clearTimeout(saveTimersRef.current[key]);
    }

    saveTimersRef.current[key] = window.setTimeout(() => {
      delete saveTimersRef.current[key];
      void persistField(contactId, field);
    }, 300);
  }

  function flushFieldSave(contactId: string, field: EditableField) {
    const key = getCellKey(contactId, field);
    if (saveTimersRef.current[key]) {
      window.clearTimeout(saveTimersRef.current[key]);
      delete saveTimersRef.current[key];
    }

    void persistField(contactId, field);
  }

  function closeLocationEditor(contactId: string, nextValue?: string) {
    const contact = contactsRef.current.find((item) => item.id === contactId);
    if (!contact) {
      return;
    }

    const finalValue = nextValue ?? getFieldValue(contact, "location");
    updateLocalContact(contactId, "location", finalValue);
    flushFieldSave(contactId, "location");
    setEditingCell((current) => (current?.contactId === contactId && current.field === "location" ? null : current));
  }

  async function copyEmail(contactId: string, email: string) {
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const input = document.createElement("input");
      input.value = email;
      input.setAttribute("readonly", "");
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    setCopiedContactId(contactId);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }

    copyResetTimerRef.current = window.setTimeout(() => {
      setCopiedContactId(null);
      copyResetTimerRef.current = null;
    }, 1500);
  }

  function openLogModal(contact: Contact) {
    setModalState({
      type: "log",
      contact,
      customDate: "",
      isSaving: false,
      showInvalidDate: false,
      step: "confirm",
    });
  }

  async function saveTouchpoint(contact: Contact, nextFollowUp: Date) {
    setModalState((current) =>
      current && current.type === "log"
        ? { ...current, isSaving: true, showInvalidDate: false }
        : current,
    );

    await updateContact(contact.id, {
      lastContacted: new Date(),
      nextFollowUp,
    });

    setModalState(null);
  }

  async function handleCustomDateSave() {
    if (!modalState || modalState.type !== "log") {
      return;
    }

    const customDate = new Date(`${modalState.customDate}T09:00:00`);
    if (Number.isNaN(customDate.getTime())) {
      setModalState({ ...modalState, showInvalidDate: true });
      return;
    }

    await saveTouchpoint(modalState.contact, customDate);
  }

  function scheduleLogTouchpoint(contact: Contact) {
    window.setTimeout(() => {
      openLogModal(contact);
    }, 400);
  }

  function flashAction(contactId: string, action: "call" | "text") {
    setFlashedAction({ contactId, action });
    if (actionFlashTimerRef.current !== null) {
      window.clearTimeout(actionFlashTimerRef.current);
    }

    actionFlashTimerRef.current = window.setTimeout(() => {
      setFlashedAction(null);
      actionFlashTimerRef.current = null;
    }, 700);
  }

  function openDeleteModal(contact: Contact) {
    setModalState({
      type: "delete",
      contact,
      isDeleting: false,
      step: "confirm",
    });
  }

  async function confirmDelete() {
    if (!modalState || modalState.type !== "delete") {
      return;
    }

    if (modalState.contact.tier === "A" && modalState.step === "confirm") {
      setModalState({ ...modalState, step: "danger" });
      return;
    }

    setModalState({ ...modalState, isDeleting: true });
    await deleteContact(modalState.contact.id);
    setModalState(null);
  }

  function updateFilters(next: {
    filter?: string | null;
    type?: string | null;
    tier?: string | null;
    location?: string | null;
  }) {
    const params = new URLSearchParams(searchParams.toString());

    if (next.filter !== undefined) {
      if (next.filter) {
        params.set("filter", next.filter);
      } else {
        params.delete("filter");
      }
    }

    if (next.type !== undefined) {
      if (next.type) {
        params.set("type", next.type);
      } else {
        params.delete("type");
      }
    }

    if (next.tier !== undefined) {
      if (next.tier) {
        params.set("tier", next.tier);
      } else {
        params.delete("tier");
      }
    }

    if (next.location !== undefined) {
      if (next.location) {
        params.set("location", next.location);
      } else {
        params.delete("location");
      }
    }

    const query = params.toString();
    router.push(query ? `/contacts?${query}` : "/contacts");
  }

  const locationOptions = Array.from(
    contacts.reduce((options, contact) => {
      const normalized = standardizeLocation(contact.location);
      if (!normalized) {
        return options;
      }

      const key = normalized.toLowerCase();
      if (!options.has(key)) {
        options.set(key, normalized);
      }

      return options;
    }, new Map<string, string>()).values(),
  ).sort((a, b) => a.localeCompare(b));

  const filteredContacts = contacts.filter((c) => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      c.name.toLowerCase().includes(normalizedSearch) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(normalizedSearch);

    const matchesTemperature = !filter || c.temperature === filter;
    const matchesTier = !tierFilter || c.tier === tierFilter;
    const matchesType = !typeFilter || c.type === typeFilter;
    const matchesLocation = !locationFilter || standardizeLocation(c.location) === locationFilter;
    return matchesSearch && matchesTemperature && matchesTier && matchesType && matchesLocation;
  });

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (tierRank[a.tier] !== tierRank[b.tier]) {
      return tierRank[a.tier] - tierRank[b.tier];
    }

    return new Date(a.nextFollowUp).getTime() - new Date(b.nextFollowUp).getTime();
  });

  const baseFilterButtonClass =
    "rounded-full px-3 py-1.5 text-sm text-slate-600 hover:-translate-y-px hover:border-slate-300 hover:bg-white";
  const activeFilterButtonClass = "rounded-full bg-slate-900 px-3 py-1.5 text-sm text-white shadow-sm";
  const actionButtonClass =
    "w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-center text-[11px] font-medium text-slate-700 shadow-sm hover:-translate-y-px hover:border-slate-400 hover:bg-slate-50 active:translate-y-0";
  const inlineInputClass =
    "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200";
  const filterSelectClass =
    "min-w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

  function renderEditableCell(contact: Contact, field: EditableField) {
    const key = getCellKey(contact.id, field);
    const isEditing = editingCell?.contactId === contact.id && editingCell.field === field;
    const status = cellStatus[key] ?? "idle";
    const value = getFieldValue(contact, field);
    const cellClass = isEditing
      ? "rounded-lg bg-slate-100 ring-2 ring-slate-200"
      : status === "saved"
        ? "rounded-lg bg-emerald-50 ring-1 ring-emerald-200"
        : status === "error"
          ? "rounded-lg bg-red-50 ring-1 ring-red-200"
          : "rounded-lg hover:bg-slate-50";

    if (field === "type" || field === "temperature" || field === "tier") {
      const options =
        field === "type"
          ? ["buyer", "seller", "investor", "renter", "lender", "inspector", "agent", "other"]
          : field === "temperature"
            ? ["hot", "warm", "cold"]
            : ["A", "B", "C", "D"];

      return (
        <td className="px-3 py-2">
          {isEditing ? (
            <div className={cellClass}>
              <select
                autoFocus
                className={inlineInputClass}
                onBlur={() => setEditingCell((current) => (current?.contactId === contact.id && current.field === field ? null : current))}
                onChange={(event) => {
                  updateLocalContact(contact.id, field, event.target.value);
                  flushFieldSave(contact.id, field);
                  setEditingCell(null);
                }}
                value={value}
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {field === "tier" ? option : option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <button
              className={`${cellClass} block w-full px-2 py-1.5 text-left text-sm text-slate-700`}
              onClick={() => setEditingCell({ contactId: contact.id, field })}
              type="button"
            >
              {field === "tier" ? value : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          )}
        </td>
      );
    }

    if (field === "location") {
      return (
        <td className="px-3 py-2">
          {isEditing ? (
            <div className={cellClass}>
              <LocationInput
                autoFocus
                contacts={contacts}
                excludeContactId={contact.id}
                onChange={(nextValue) => {
                  updateLocalContact(contact.id, field, nextValue);
                }}
                onCommit={(nextValue) => {
                  closeLocationEditor(contact.id, nextValue);
                }}
                value={value}
              />
            </div>
          ) : (
            <button
              className={`${cellClass} block w-full px-2 py-1.5 text-left text-sm ${value ? "text-slate-700" : "text-slate-400"}`}
              onClick={() => {
                setEditingCell({ contactId: contact.id, field });
              }}
              type="button"
            >
              {value || "-"}
            </button>
          )}
        </td>
      );
    }

    return (
      <td className="px-3 py-2">
        {isEditing ? (
          <div className={cellClass}>
            <input
              autoFocus
              className={inlineInputClass}
              onBlur={() => {
                flushFieldSave(contact.id, field);
                setEditingCell((current) => (current?.contactId === contact.id && current.field === field ? null : current));
              }}
              onChange={(event) => {
                updateLocalContact(contact.id, field, event.target.value);
                scheduleFieldSave(contact.id, field);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  flushFieldSave(contact.id, field);
                  setEditingCell(null);
                  (event.currentTarget as HTMLInputElement).blur();
                }
              }}
              placeholder={field === "phone" ? "Phone" : "Email"}
              type={field === "email" ? "email" : "tel"}
              value={value}
            />
          </div>
        ) : (
          <button
            className={`${cellClass} block w-full px-2 py-1.5 text-left text-sm ${value ? "text-slate-700" : "text-slate-400"}`}
            onClick={() => setEditingCell({ contactId: contact.id, field })}
            type="button"
          >
            {value || "-"}
          </button>
        )}
      </td>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-semibold">Contacts</h1>
        <p className="mt-1 text-sm text-slate-500">Search, slice, and act without leaving the sheet.</p>
      </div>

      <div className="border-b border-slate-200 px-4 py-3">
        <input
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, phone, or email..."
          type="search"
          value={search}
        />
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              className={!filter ? activeFilterButtonClass : `${baseFilterButtonClass} border border-slate-200`}
              onClick={() => updateFilters({ filter: null })}
              type="button"
            >
              All
            </button>
            <button
              className={filter === "hot" ? activeFilterButtonClass : `${baseFilterButtonClass} border border-red-200 bg-red-50/50`}
              onClick={() => updateFilters({ filter: "hot" })}
              type="button"
            >
              Hot
            </button>
            <button
              className={
                filter === "warm" ? activeFilterButtonClass : `${baseFilterButtonClass} border border-amber-200 bg-amber-50/50`
              }
              onClick={() => updateFilters({ filter: "warm" })}
              type="button"
            >
              Warm
            </button>
            <button
              className={
                filter === "cold" ? activeFilterButtonClass : `${baseFilterButtonClass} border border-sky-200 bg-sky-50/50`
              }
              onClick={() => updateFilters({ filter: "cold" })}
              type="button"
            >
              Cold
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["A", "B", "C", "D"] as const).map((tier) => (
              <button
                className={tierFilter === tier ? activeFilterButtonClass : `${baseFilterButtonClass} border border-slate-200`}
                key={tier}
                onClick={() => updateFilters({ tier: tierFilter === tier ? null : tier })}
                type="button"
              >
                {tier}
              </button>
            ))}

            <label className="sr-only" htmlFor="type-filter">
              Type
            </label>
            <select
              className={filterSelectClass}
              id="type-filter"
              onChange={(event) => updateFilters({ type: event.target.value || null })}
              value={typeFilter ?? ""}
            >
              <option value="">Type: All</option>
              {typeFilters.map((option) => (
                <option key={option.value} value={option.value}>
                  {`Type: ${option.label}`}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="location-filter">
              Location
            </label>
            <select
              className={filterSelectClass}
              id="location-filter"
              onChange={(event) => updateFilters({ location: event.target.value || null })}
              value={locationFilter ?? ""}
            >
              <option value="">Location: All</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {`Location: ${location}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center">
          <p className="text-sm font-medium text-slate-500">
            {filteredContacts.length} {filteredContacts.length === 1 ? "contact" : "contacts"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm">
            <tr className="text-left">
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Location</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Temp</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Next Action</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Last Contact</th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>

          <tbody>
            {sortedContacts.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center" colSpan={10}>
                  <p className="text-base font-medium text-slate-900">No contacts found</p>
                  <p className="mt-1 text-sm text-slate-500">Try adjusting filters or search.</p>
                </td>
              </tr>
            ) : null}
            {sortedContacts.map((c) => {
              const overdue = isOverdue(c.nextFollowUp);
              const nextActionDays = daysUntil(c.nextFollowUp);
              const rowBase = overdue ? "bg-red-50/60" : "bg-white";

              return (
                <tr
                  key={c.id}
                  className={`${rowBase} border-b border-slate-200 hover:bg-slate-50`}
                >
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <Link className="rounded-md px-1 py-0.5 hover:bg-slate-100 hover:underline" href={`/contact/${c.id}`}>
                      {c.name}
                    </Link>
                  </td>
                  {renderEditableCell(c, "type")}
                  {renderEditableCell(c, "location")}
                  {renderEditableCell(c, "temperature")}
                  {renderEditableCell(c, "tier")}
                  {renderEditableCell(c, "phone")}
                  {renderEditableCell(c, "email")}
                  <td className={nextActionDays < 0 ? "px-3 py-2 font-semibold text-red-600" : "px-3 py-2 font-medium text-slate-700"}>
                    {nextActionDays < 0 ? `${Math.abs(nextActionDays)}d overdue` : `${nextActionDays}d`}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{daysSince(c.lastContacted)}d ago</td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-2">
                        {c.phone ? (
                          <button
                            className={`${actionButtonClass} ${flashedAction?.contactId === c.id && flashedAction.action === "call" ? "border-slate-900 bg-slate-900 text-white" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`tel:${c.phone}`);
                              flashAction(c.id, "call");
                              scheduleLogTouchpoint(c);
                            }}
                            type="button"
                          >
                            Call
                          </button>
                        ) : (
                          <div className="w-16" />
                        )}

                        {c.phone ? (
                          <button
                            className={`${actionButtonClass} ${flashedAction?.contactId === c.id && flashedAction.action === "text" ? "border-slate-900 bg-slate-900 text-white" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`sms:${c.phone}`);
                              flashAction(c.id, "text");
                              scheduleLogTouchpoint(c);
                            }}
                            type="button"
                          >
                            Text
                          </button>
                        ) : (
                          <div className="w-16" />
                        )}

                        {c.email ? (
                          <button
                            className={`${actionButtonClass} ${copiedContactId === c.id ? "border-emerald-300 bg-emerald-50 text-emerald-700" : ""}`}
                            onClick={async (e) => {
                              e.stopPropagation();
                              await copyEmail(c.id, c.email);
                              openLogModal(c);
                            }}
                            type="button"
                          >
                            {copiedContactId === c.id ? "Copied ✓" : "Copy Email"}
                          </button>
                        ) : (
                          <div className="w-16" />
                        )}
                      </div>

                      <button
                        className="rounded-md border border-red-200 bg-white px-2 py-1.5 text-[11px] font-medium text-red-600 shadow-sm hover:-translate-y-px hover:border-red-300 hover:bg-red-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(c);
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="crm-fade-up w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            {modalState.type === "log" ? (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Log Contact</h2>
                {modalState.step === "confirm" ? (
                  <>
                    <p className="mt-2 text-sm text-slate-600">Did you contact them?</p>
                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setModalState(null)}
                        type="button"
                      >
                        No
                      </button>
                      <button
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow-sm hover:bg-slate-800"
                        onClick={() => setModalState({ ...modalState, step: "schedule" })}
                        type="button"
                      >
                        Yes
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-slate-600">When should you follow up?</p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        disabled={modalState.isSaving}
                        onClick={() => void saveTouchpoint(modalState.contact, addDays(new Date(), 1))}
                        type="button"
                      >
                        Tomorrow
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        disabled={modalState.isSaving}
                        onClick={() => void saveTouchpoint(modalState.contact, addDays(new Date(), 3))}
                        type="button"
                      >
                        3 Days
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        disabled={modalState.isSaving}
                        onClick={() => void saveTouchpoint(modalState.contact, addDays(new Date(), 7))}
                        type="button"
                      >
                        7 Days
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        disabled={modalState.isSaving}
                        onClick={() => void saveTouchpoint(modalState.contact, addDays(new Date(), 14))}
                        type="button"
                      >
                        14 Days
                      </button>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm text-slate-700" htmlFor="custom-follow-up">
                        Custom date
                      </label>
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                        id="custom-follow-up"
                        onChange={(event) =>
                          setModalState(
                            modalState.type === "log"
                              ? { ...modalState, customDate: event.target.value, showInvalidDate: false }
                              : modalState,
                          )
                        }
                        type="date"
                        value={modalState.customDate}
                      />
                      {modalState.showInvalidDate ? (
                        <p className="mt-2 text-xs text-red-600">Choose a valid date.</p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        disabled={modalState.isSaving}
                        onClick={() => setModalState(null)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white shadow-sm hover:bg-slate-800"
                        disabled={modalState.isSaving}
                        onClick={() => void handleCustomDateSave()}
                        type="button"
                      >
                        {modalState.isSaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Delete Contact</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {modalState.step === "danger"
                    ? "This is an A-tier contact. Are you really sure you want to delete them?"
                    : `Delete ${modalState.contact.name}? This cannot be undone.`}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    disabled={modalState.isDeleting}
                    onClick={() => setModalState(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    disabled={modalState.isDeleting}
                    onClick={() => void confirmDelete()}
                    type="button"
                  >
                    {modalState.isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
