// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Aenderungsvorschlag {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    titel?: string;
    kategorie?: LookupValue;
    betroffener_bereich?: string;
    beschreibung?: string;
    screenshots?: string;
    einreicher_vorname?: string;
    einreicher_nachname?: string;
    einreicher_email?: string;
    einreichungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    prioritaet?: LookupValue;
    status?: LookupValue;
    bearbeiter_vorname?: string;
    bearbeiter_nachname?: string;
    umsetzungskommentar?: string;
    erledigungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export const APP_IDS = {
  AENDERUNGSVORSCHLAG: '6a0d57d1b2df9e9b5d107877',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'aenderungsvorschlag': {
    kategorie: [{ key: "benutzeroberflaeche", label: "Benutzeroberfläche" }, { key: "funktionalitaet", label: "Funktionalität" }, { key: "performance", label: "Performance" }, { key: "sicherheit", label: "Sicherheit" }, { key: "barrierefreiheit", label: "Barrierefreiheit" }, { key: "sonstiges", label: "Sonstiges" }],
    prioritaet: [{ key: "niedrig", label: "Niedrig" }, { key: "mittel", label: "Mittel" }, { key: "hoch", label: "Hoch" }, { key: "kritisch", label: "Kritisch" }],
    status: [{ key: "offen", label: "Offen" }, { key: "in_pruefung", label: "In Prüfung" }, { key: "in_bearbeitung", label: "In Bearbeitung" }, { key: "umgesetzt", label: "Umgesetzt" }, { key: "abgelehnt", label: "Abgelehnt" }, { key: "zurueckgestellt", label: "Zurückgestellt" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'aenderungsvorschlag': {
    'titel': 'string/text',
    'kategorie': 'lookup/select',
    'betroffener_bereich': 'string/text',
    'beschreibung': 'string/textarea',
    'screenshots': 'file',
    'einreicher_vorname': 'string/text',
    'einreicher_nachname': 'string/text',
    'einreicher_email': 'string/email',
    'einreichungsdatum': 'date/date',
    'prioritaet': 'lookup/radio',
    'status': 'lookup/select',
    'bearbeiter_vorname': 'string/text',
    'bearbeiter_nachname': 'string/text',
    'umsetzungskommentar': 'string/textarea',
    'erledigungsdatum': 'date/date',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAenderungsvorschlag = StripLookup<Aenderungsvorschlag['fields']>;