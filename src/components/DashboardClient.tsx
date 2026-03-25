"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ContactCard } from "@/components/ContactCard";
import { DoneFollowUpModal } from "@/components/DoneFollowUpModal";
import { addDays, isOverdue, isSameDay } from "@/lib/date";
import { getContacts, updateContact } from "@/lib/storage";
import { getDefaultFollowUp } from "@/lib/utils";
import type { Contact } from "@/lib/types";

function byNextFollowUp(a: Contact, b: Contact): number {
  return a.nextFollowUp.getTime() - b.nextFollowUp.getTime();
}

function getDueContacts(source: Contact[]): Contact[] {
  const now = new Date();
  const overdue = source.filter((contact) => isOverdue(contact.nextFollowUp, now));
  const today = source.filter((contact) => isSameDay(contact.nextFollowUp, now));
  return [...overdue, ...today];
}

export default function DashboardClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [highlightedContactId, setHighlightedContactId] = useState<string | null>(null);

  const refreshContacts = useCallback(async () => {
    const loaded = (await getContacts()).sort(byNextFollowUp);
    setContacts(loaded);
    return loaded;
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
    if (!highlightedContactId) {
      return;
    }

    const timer = window.setTimeout(() => {
      const element = document.getElementById(`contact-card-${highlightedContactId}`);
      element?.scrollIntoView({ behavior: "auto", block: "center" });
      element?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [contacts, highlightedContactId]);

  const { overdue, today, dueContacts } = useMemo(() => {
    const now = new Date();
    const overdueContacts = contacts.filter((contact) => isOverdue(contact.nextFollowUp, now));
    const todayContacts = contacts.filter((contact) => isSameDay(contact.nextFollowUp, now));

    return {
      overdue: overdueContacts,
      today: todayContacts,
      dueContacts: [...overdueContacts, ...todayContacts],
    };
  }, [contacts]);

  const activeContact =
    dueContacts.find((contact) => contact.id === highlightedContactId) ?? dueContacts[0] ?? null;

  useEffect(() => {
    if (dueContacts.length === 0) {
      if (!highlightedContactId) {
        return;
      }

      const timer = window.setTimeout(() => {
        setHighlightedContactId(null);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    if (highlightedContactId && dueContacts.some((contact) => contact.id === highlightedContactId)) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightedContactId(dueContacts[0].id);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [dueContacts, highlightedContactId]);

  const applyDone = useCallback(
    async (contact: Contact, nextFollowUp: Date | null, noteText: string) => {
      const now = new Date();
      const resolvedNextFollowUp =
        nextFollowUp ??
        getDefaultFollowUp({
          name: contact.name,
          type: contact.type,
          temperature: contact.temperature,
        });

      const updated: Contact = {
        ...contact,
        nextFollowUp: resolvedNextFollowUp,
        lastContacted: now,
        notes: noteText.length > 0 ? [...contact.notes, { text: noteText, date: now }] : contact.notes,
      };

      await updateContact(contact.id, {
        nextFollowUp: updated.nextFollowUp,
        lastContacted: updated.lastContacted,
        notes: updated.notes,
      });
      setSelectedContact(null);
      const refreshed = await refreshContacts();
      const nextDue = getDueContacts(refreshed)[0];
      setHighlightedContactId(nextDue ? nextDue.id : null);
    },
    [refreshContacts],
  );

  async function handleDone(nextFollowUp: Date | null, noteText: string) {
    if (!selectedContact) {
      return;
    }

    await applyDone(selectedContact, nextFollowUp, noteText);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) {
        return;
      }

      const targetContact = selectedContact ?? activeContact;
      if (!targetContact) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void applyDone(targetContact, null, "");
        return;
      }

      if (event.key === "1") {
        event.preventDefault();
        void applyDone(targetContact, addDays(new Date(), 1), "");
        return;
      }

      if (event.key === "3") {
        event.preventDefault();
        void applyDone(targetContact, addDays(new Date(), 3), "");
        return;
      }

      if (event.key === "7") {
        event.preventDefault();
        void applyDone(targetContact, addDays(new Date(), 7), "");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeContact, applyDone, selectedContact]);

  const dueCount = overdue.length + today.length;
  const sectionCardClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

  return (
    <main className="space-y-5">
      <section className={`${sectionCardClass} px-4 py-3`}>
        <h1 className="text-lg font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Track today&apos;s follow-ups and move through your list quickly.</p>
        <p className="mt-3 text-sm font-medium text-slate-700">You have {dueCount} people to contact today.</p>
        {dueCount === 0 ? (
          <p className="mt-2 text-sm font-medium text-slate-900">You&apos;re done for today.</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Overdue</h2>
        <div className="space-y-3">
          {overdue.length === 0 ? (
            <p className={`${sectionCardClass} p-4 text-sm text-slate-600`}>
              No overdue follow-ups.
            </p>
          ) : (
            overdue.map((contact) => (
              <ContactCard
                contact={contact}
                isHighlighted={highlightedContactId === contact.id}
                key={contact.id}
                onDone={(next) => {
                  setHighlightedContactId(next.id);
                  setSelectedContact(next);
                }}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Today</h2>
        <div className="space-y-3">
          {today.length === 0 ? (
            <p className={`${sectionCardClass} p-4 text-sm text-slate-600`}>
              No follow-ups due today.
            </p>
          ) : (
            today.map((contact) => (
              <ContactCard
                contact={contact}
                isHighlighted={highlightedContactId === contact.id}
                key={contact.id}
                onDone={(next) => {
                  setHighlightedContactId(next.id);
                  setSelectedContact(next);
                }}
              />
            ))
          )}
        </div>
      </section>

      {selectedContact ? (
        <DoneFollowUpModal
          name={selectedContact.name}
          onCancel={() => void handleDone(null, "")}
          onSave={handleDone}
        />
      ) : null}
    </main>
  );
}
