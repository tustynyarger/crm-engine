"use client";

import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import LocationInput from "@/components/LocationInput";
import { addContact, getContacts } from "@/lib/storage";
import { getDefaultFollowUp } from "@/lib/utils";
import type { Contact, ContactKind, LocationKind, NewContactInput, TemperatureKind, TierKind } from "@/lib/types";

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.25)]";
const sectionLabelClass = "block text-sm text-slate-700";
const saveButtonBaseClass =
  "rounded-lg px-3 py-2 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70";
const surfaceClass = "rounded-2xl border border-slate-200 bg-white shadow-sm";

type ImportField = "name" | "phone" | "email" | "social" | "location" | "notes" | "temperature" | "tier";
type ImportMapping = Record<ImportField, string>;
type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};
type CsvNameColumns = {
  firstName: string;
  lastName: string;
};

const importFields: Array<{ field: ImportField; label: string }> = [
  { field: "name", label: "Name" },
  { field: "phone", label: "Phone" },
  { field: "email", label: "Email" },
  { field: "social", label: "Social" },
  { field: "location", label: "Location" },
  { field: "notes", label: "Notes" },
  { field: "temperature", label: "Temperature" },
  { field: "tier", label: "Tier" },
];

const emptyMapping: ImportMapping = {
  name: "",
  phone: "",
  email: "",
  social: "",
  location: "",
  notes: "",
  temperature: "",
  tier: "",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findHeader(headers: string[], candidates: string[]): string {
  const normalizedCandidates = candidates.map(normalizeHeader);
  return headers.find((header) => normalizedCandidates.includes(normalizeHeader(header))) ?? "";
}

function getAutoMapping(headers: string[]): ImportMapping {
  return {
    name: findHeader(headers, ["full name", "name", "contact name", "display name"]),
    phone: findHeader(headers, ["phone", "mobile phone", "cell phone", "home phone", "business phone", "phone number"]),
    email: findHeader(headers, ["email", "email1", "email address", "primary email"]),
    social: findHeader(headers, ["social", "instagram", "linkedin", "facebook", "x", "twitter", "website"]),
    location: findHeader(headers, ["location", "city", "address", "address1"]),
    notes: findHeader(headers, ["notes", "note", "comments", "comment"]),
    temperature: findHeader(headers, ["temperature", "temp", "lead temperature", "lead temp"]),
    tier: findHeader(headers, ["tier", "lead tier", "priority", "grade"]),
  };
}

function getAutoNameColumns(headers: string[]): CsvNameColumns {
  return {
    firstName: findHeader(headers, ["first name", "firstname", "given name"]),
    lastName: findHeader(headers, ["last name", "lastname", "surname", "family name"]),
  };
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let isQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (isQuoted && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }
      continue;
    }

    if (char === "," && !isQuoted) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !isQuoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const [headerRow, ...dataRows] = rows.filter((row) => row.some((cell) => cell.trim().length > 0));
  const headers = (headerRow ?? []).map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());

  return {
    headers,
    rows: dataRows.map((row) =>
      headers.reduce<Record<string, string>>((record, header, index) => {
        record[header] = (row[index] ?? "").trim();
        return record;
      }, {}),
    ),
  };
}

function getMappedValue(row: Record<string, string>, mapping: ImportMapping, field: ImportField): string {
  const header = mapping[field];
  return header ? row[header]?.trim() ?? "" : "";
}

function getImportName(row: Record<string, string>, mapping: ImportMapping, nameColumns: CsvNameColumns): string {
  const mappedName = getMappedValue(row, mapping, "name");
  if (mappedName) {
    return mappedName;
  }

  return `${row[nameColumns.firstName]?.trim() ?? ""} ${row[nameColumns.lastName]?.trim() ?? ""}`.trim();
}

function getImportTemperature(row: Record<string, string>, mapping: ImportMapping): TemperatureKind {
  const value = getMappedValue(row, mapping, "temperature").toLowerCase();
  if (value === "hot" || value === "warm" || value === "cold") {
    return value;
  }

  return "warm";
}

function getImportTier(row: Record<string, string>, mapping: ImportMapping): TierKind {
  const value = getMappedValue(row, mapping, "tier").toUpperCase();
  if (value === "A" || value === "B" || value === "C" || value === "D") {
    return value;
  }

  return "C";
}

export default function AddContactPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [social, setSocial] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<ContactKind>("other");
  const [location, setLocation] = useState<LocationKind>("");
  const [temperature, setTemperature] = useState<TemperatureKind>("warm");
  const [tier, setTier] = useState<TierKind>("C");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [importMapping, setImportMapping] = useState<ImportMapping>(emptyMapping);
  const [autoNameColumns, setAutoNameColumns] = useState<CsvNameColumns>({ firstName: "", lastName: "" });
  const [importStatus, setImportStatus] = useState<"idle" | "parsing" | "importing" | "success" | "error">("idle");
  const [importMessage, setImportMessage] = useState("");

  const importPreview = useMemo(() => {
    if (!parsedCsv) {
      return { contacts: [], skipped: 0 };
    }

    const now = new Date();
    let skipped = 0;
    const importedContacts: NewContactInput[] = [];

    for (const row of parsedCsv.rows) {
      const importedName = getImportName(row, importMapping, autoNameColumns);

      if (!importedName) {
        skipped += 1;
        continue;
      }

      const importedNotes = getMappedValue(row, importMapping, "notes");
      const importedTemperature = getImportTemperature(row, importMapping);
      const importedTier = getImportTier(row, importMapping);
      importedContacts.push({
        name: importedName,
        phone: getMappedValue(row, importMapping, "phone") || undefined,
        email: getMappedValue(row, importMapping, "email") || undefined,
        social: getMappedValue(row, importMapping, "social") || undefined,
        type: "other",
        location: getMappedValue(row, importMapping, "location"),
        temperature: importedTemperature,
        tier: importedTier,
        nextFollowUp: getDefaultFollowUp({
          name: importedName,
          type: "other",
          temperature: importedTemperature,
        }),
        lastContacted: now,
        notes: importedNotes ? [{ text: importedNotes, date: now }] : [],
      });
    }

    return { contacts: importedContacts, skipped };
  }, [autoNameColumns, importMapping, parsedCsv]);

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
        notes: note.trim()
          ? [{ text: note.trim(), date: now }]
          : [],
      });

      setNote("");
      setSaveStatus("success");
      window.setTimeout(() => {
        router.push("/");
      }, 700);
    } catch {
      setSaveStatus("error");
    }
  }

  async function handleCsvFile(file: File) {
    setImportStatus("parsing");
    setImportMessage("");

    try {
      const text = await file.text();
      const nextParsedCsv = parseCsv(text);
      setParsedCsv(nextParsedCsv);
      setImportMapping(getAutoMapping(nextParsedCsv.headers));
      setAutoNameColumns(getAutoNameColumns(nextParsedCsv.headers));
      setImportStatus("idle");
    } catch {
      setImportStatus("error");
      setImportMessage("Unable to read this CSV file.");
    }
  }

  function handleCsvInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      void handleCsvFile(file);
    }
  }

  function handleCsvDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleCsvFile(file);
    }
  }

  async function handleImportContacts() {
    if (!parsedCsv || importStatus === "importing") {
      return;
    }

    setImportStatus("importing");
    setImportMessage("");

    try {
      let imported = 0;

      for (const contact of importPreview.contacts) {
        await addContact(contact);
        imported += 1;
      }

      setContacts(await getContacts());
      setImportStatus("success");
      setImportMessage(`Imported ${imported} contacts. Skipped ${importPreview.skipped} rows.`);
    } catch {
      setImportStatus("error");
      setImportMessage("Import failed. Check the CSV mapping and try again.");
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

          <div>
            <label className={sectionLabelClass} htmlFor="note">
              Note
            </label>
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#007AFF] focus:ring-2 focus:ring-[rgba(0,122,255,0.25)]"
              id="note"
              onChange={(event) => {
                setSaveStatus((current) => (current === "success" ? "idle" : current));
                setNote(event.target.value);
              }}
              placeholder="Add context, conversation details, or next steps..."
              value={note}
            />
          </div>

          <button
            className={
              saveStatus === "success"
                ? `${saveButtonBaseClass} bg-emerald-600`
                : saveStatus === "error"
                  ? `${saveButtonBaseClass} bg-red-600`
                  : `${saveButtonBaseClass} bg-[#007AFF] hover:bg-[#0066CC]`
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

      <section className={`${surfaceClass} p-4 sm:p-5`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Import Contacts</h2>
          <p className="mt-1 text-sm text-slate-500">Upload a CSV, map columns, and preview contacts before importing.</p>
        </div>

        <div
          className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleCsvDrop}
        >
          <input
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvInputChange}
            ref={fileInputRef}
            type="file"
          />
          <p className="text-sm font-medium text-slate-700">Drop a CSV file here</p>
          <p className="mt-1 text-sm text-slate-500">or choose a file from your computer.</p>
          <button
            className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Choose CSV
          </button>
        </div>

        {parsedCsv ? (
          <div className="mt-5 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Map Columns</h3>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {importFields.map(({ field, label }) => (
                  <label className="block text-sm text-slate-700" key={field}>
                    {label}
                    <select
                      className={inputClass}
                      onChange={(event) => {
                        setImportStatus((current) => (current === "success" || current === "error" ? "idle" : current));
                        setImportMapping((current) => ({ ...current, [field]: event.target.value }));
                      }}
                      value={importMapping[field]}
                    >
                      <option value="">Not mapped</option>
                      {parsedCsv.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
                <p className="text-sm text-slate-500">
                  {importPreview.contacts.length} ready, {importPreview.skipped} skipped
                </p>
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Phone</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Social</th>
                      <th className="px-3 py-2 font-semibold">Location</th>
                      <th className="px-3 py-2 font-semibold">Temp</th>
                      <th className="px-3 py-2 font-semibold">Tier</th>
                      <th className="px-3 py-2 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.contacts.slice(0, 10).map((contact, index) => (
                      <tr className="border-t border-slate-200" key={`${contact.name}-${index}`}>
                        <td className="px-3 py-2 font-medium text-slate-900">{contact.name}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.phone ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.email ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.social ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.location || "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.temperature}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.tier}</td>
                        <td className="px-3 py-2 text-slate-600">{contact.notes[0]?.text ?? "-"}</td>
                      </tr>
                    ))}
                    {importPreview.contacts.length === 0 ? (
                      <tr>
                        <td className="px-3 py-6 text-center text-slate-500" colSpan={8}>
                          No importable contacts found. Map a name column.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            {importMessage ? (
              <p className={importStatus === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
                {importMessage}
              </p>
            ) : null}

            <button
            className="rounded-lg bg-[#007AFF] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#0066CC] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={importStatus === "importing" || importPreview.contacts.length === 0}
              onClick={() => void handleImportContacts()}
              type="button"
            >
              {importStatus === "importing" ? "Importing..." : "Import Contacts"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
