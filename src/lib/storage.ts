import { supabase } from "@/lib/supabase";
import type { Contact, ContactNote, NewContactInput, TierKind } from "@/lib/types";

type ContactRow = {
  id: string;
  name: string;
  type: string;
  location: string;
  temperature: string;
  tier: string | null;
  pipeline: string | null;
  stage: string | null;
  phone: string | null;
  email: string | null;
  social: string | null;
  next_follow_up: string | null;
  last_contacted: string | null;
  notes: unknown;
  created_at: string | null;
};

type ContactInsert = {
  name: string;
  type: string;
  location: string;
  temperature: string;
  tier: string;
  pipeline: string;
  stage: string;
  phone: string | null;
  email: string | null;
  social: string | null;
  next_follow_up: string;
  last_contacted: string;
  notes: Array<{ text: string; date: string }>;
};

type ContactUpdate = Partial<{
  name: string;
  type: string;
  location: string;
  temperature: string;
  tier: string;
  pipeline: string;
  stage: string;
  phone: string | null;
  email: string | null;
  social: string | null;
  next_follow_up: string;
  last_contacted: string;
  notes: Array<{ text: string; date: string }>;
}>;

function dispatchContactsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("crm-engine:contacts-updated"));
  }
}

function toSerializedNotes(notes: ContactNote[]): Array<{ text: string; date: string }> {
  return notes.map((note) => ({
    text: note.text,
    date: note.date.toISOString(),
  }));
}

function toContactInsert(contact: Omit<Contact, "id">): ContactInsert {
  return {
    name: contact.name,
    type: contact.type,
    location: contact.location,
    temperature: contact.temperature,
    tier: contact.tier,
    // Hidden DB compatibility fields until the table schema is simplified.
    pipeline: "buyer",
    stage: "Lead",
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    social: contact.social ?? null,
    next_follow_up: contact.nextFollowUp.toISOString(),
    last_contacted: contact.lastContacted.toISOString(),
    notes: toSerializedNotes(contact.notes),
  };
}

function toContactUpdate(updates: Partial<Contact>): ContactUpdate {
  const payload: ContactUpdate = {};

  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.type !== undefined) payload.type = updates.type;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.temperature !== undefined) payload.temperature = updates.temperature;
  if (updates.tier !== undefined) payload.tier = updates.tier;
  if (updates.phone !== undefined) payload.phone = updates.phone ?? null;
  if (updates.email !== undefined) payload.email = updates.email ?? null;
  if (updates.social !== undefined) payload.social = updates.social ?? null;
  if (updates.nextFollowUp !== undefined) payload.next_follow_up = updates.nextFollowUp.toISOString();
  if (updates.lastContacted !== undefined) payload.last_contacted = updates.lastContacted.toISOString();
  if (updates.notes !== undefined) payload.notes = toSerializedNotes(updates.notes);

  return payload;
}

function normalizeTier(tier: string | null): TierKind {
  if (tier === "A" || tier === "B" || tier === "C" || tier === "D") {
    return tier;
  }

  return "C";
}

function toContactNotes(notes: unknown): ContactNote[] {
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const maybeNote = item as { text?: unknown; date?: unknown };
      if (typeof maybeNote.text !== "string") {
        return null;
      }

      const parsedDate = new Date(String(maybeNote.date ?? new Date().toISOString()));
      if (Number.isNaN(parsedDate.getTime())) {
        return null;
      }

      return {
        text: maybeNote.text,
        date: parsedDate,
      } satisfies ContactNote;
    })
    .filter((note): note is ContactNote => Boolean(note));
}

function fromRow(row: ContactRow): Contact {
  const tier = normalizeTier(row.tier);

  return {
    id: row.id,
    name: row.name,
    type: row.type as Contact["type"],
    location: row.location as Contact["location"],
    temperature: row.temperature as Contact["temperature"],
    tier,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    social: row.social ?? undefined,
    nextFollowUp: new Date(row.next_follow_up ?? new Date().toISOString()),
    lastContacted: new Date(row.last_contacted ?? new Date().toISOString()),
    notes: toContactNotes(row.notes),
  };
}

export async function getContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("next_follow_up", { ascending: true });

  if (error) {
    throw new Error(`Failed to load contacts: ${error.message}`);
  }

  return (data as ContactRow[]).map(fromRow);
}

export async function saveContacts(contacts: Contact[]): Promise<void> {
  const payload = contacts.map((contact) => ({
    id: contact.id,
    ...toContactInsert(contact),
  }));

  const { error } = await supabase.from("contacts").upsert(payload, { onConflict: "id" });

  if (error) {
    throw new Error(`Failed to save contacts: ${error.message}`);
  }

  dispatchContactsUpdated();
}

export async function addContact(contact: NewContactInput): Promise<Contact> {
  const payload = toContactInsert(contact);

  const { data, error } = await supabase.from("contacts").insert(payload).select("*").single();

  if (error || !data) {
    throw new Error(`Failed to add contact: ${error?.message ?? "No data returned"}`);
  }

  dispatchContactsUpdated();
  return fromRow(data as ContactRow);
}

export async function updateContact(id: string, updates: Partial<Contact>): Promise<Contact> {
  const payload = toContactUpdate(updates);

  const { data, error } = await supabase
    .from("contacts")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update contact: ${error?.message ?? "No data returned"}`);
  }

  dispatchContactsUpdated();
  return fromRow(data as ContactRow);
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete contact: ${error.message}`);
  }

  dispatchContactsUpdated();
}
