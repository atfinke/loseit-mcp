/**
 * GWT-RPC response format:
 *   //OK[<payload_values>..., ["<string_table_entries>"], <flags>, <version>]
 *
 * Read right-to-left: version (7), flags (0), string table, then payload.
 * String references are 1-based (0 = null).
 * Negative integers are back-references to previously seen objects.
 * Fields are serialized in Java declaration order, superclass first.
 */

export interface GwtResponse {
  version: number;
  flags: number;
  stringTable: string[];
  values: unknown[];
}

export class GwtParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GwtParseError";
  }
}

export function parseGwtResponse(raw: string): GwtResponse {
  const trimmed = raw.trim();

  if (trimmed.startsWith("//EX")) {
    throw new GwtParseError(
      `GWT-RPC exception response: ${trimmed.slice(0, 200)}`,
    );
  }

  if (!trimmed.startsWith("//OK")) {
    throw new GwtParseError(
      `Unexpected GWT-RPC response prefix: ${trimmed.slice(0, 20)}`,
    );
  }

  const jsonStr = trimmed.slice(4);
  let parsed: unknown[];

  try {
    parsed = JSON.parse(jsonStr) as unknown[];
  } catch {
    throw new GwtParseError(
      `Failed to parse GWT-RPC response as JSON: ${jsonStr.slice(0, 200)}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new GwtParseError("GWT-RPC response array too short");
  }

  const version = parsed[parsed.length - 1] as number;
  const flags = parsed[parsed.length - 2] as number;

  const stringTableIndex = parsed.length - 3;
  const stringTable = parsed[stringTableIndex];

  if (!Array.isArray(stringTable)) {
    throw new GwtParseError("Could not find string table in GWT-RPC response");
  }

  const values = parsed.slice(0, stringTableIndex);

  return {
    version,
    flags,
    stringTable: stringTable as string[],
    values,
  };
}

// --- Type Registry ---

export type GwtFieldType =
  | "int"
  | "double"
  | "boolean"
  | "long"
  | "string"
  | "object"
  | "byte_array";

export interface GwtFieldDef {
  name: string;
  type: GwtFieldType;
}

const typeRegistry = new Map<string, GwtFieldDef[]>();

export function registerGwtType(
  className: string,
  fields: GwtFieldDef[],
): void {
  typeRegistry.set(className, fields);
}

export function lookupGwtType(classNameWithHash: string): GwtFieldDef[] | null {
  const slashIndex = classNameWithHash.lastIndexOf("/");
  const className =
    slashIndex >= 0
      ? classNameWithHash.slice(0, slashIndex)
      : classNameWithHash;
  return typeRegistry.get(className) ?? null;
}

// --- GwtReader: sequential cursor ---

export class GwtReader {
  private pos = 0;
  private readonly objectTable: Map<number, Record<string, unknown>> =
    new Map();
  private objectCounter = 0;

  constructor(
    private readonly values: unknown[],
    private readonly stringTable: string[],
  ) {}

  get position(): number {
    return this.pos;
  }

  get remaining(): number {
    return this.values.length - this.pos;
  }

  peek(): unknown {
    return this.values[this.pos];
  }

  readInt(): number {
    const val = this.values[this.pos++];
    if (typeof val !== "number") {
      throw new GwtParseError(
        `Expected int at position ${this.pos - 1}, got ${typeof val}: ${String(val)}`,
      );
    }
    return val;
  }

  readDouble(): number {
    const val = this.values[this.pos++];
    if (typeof val !== "number") {
      throw new GwtParseError(
        `Expected double at position ${this.pos - 1}, got ${typeof val}: ${String(val)}`,
      );
    }
    return val;
  }

  readBoolean(): boolean {
    const val = this.readInt();
    return val !== 0;
  }

  readString(): string | null {
    const index = this.readInt();
    if (index === 0) return null;
    const str = this.stringTable[index - 1];
    if (str === undefined) {
      throw new GwtParseError(
        `String table index ${index} out of bounds (table size ${this.stringTable.length})`,
      );
    }
    return str;
  }

  readLong(): number {
    const high = this.readInt();
    const low = this.readInt();
    return high * 0x100000000 + (low >>> 0);
  }

  readByteArray(): number[] {
    const index = this.readInt();
    if (index === 0) return [];
    const str = this.stringTable[index - 1];
    if (str === undefined) return [];
    return Array.from(str, (ch) => ch.charCodeAt(0));
  }

  readField(type: GwtFieldType): unknown {
    switch (type) {
      case "int":
        return this.readInt();
      case "double":
        return this.readDouble();
      case "boolean":
        return this.readBoolean();
      case "long":
        return this.readLong();
      case "string":
        return this.readString();
      case "byte_array":
        return this.readByteArray();
      case "object":
        return this.readObject();
    }
  }

  readObject(): Record<string, unknown> | null {
    const classIndex = this.readInt();

    if (classIndex < 0) {
      const ref = this.objectTable.get(-classIndex);
      if (!ref) {
        throw new GwtParseError(
          `Back-reference ${classIndex} not found in object table`,
        );
      }
      return ref;
    }

    if (classIndex === 0) return null;

    const className = this.stringTable[classIndex - 1];
    if (className === undefined) {
      throw new GwtParseError(
        `Class name index ${classIndex} out of bounds`,
      );
    }

    this.objectCounter++;
    const objectId = this.objectCounter;

    const fields = lookupGwtType(className);
    if (!fields) {
      const obj: Record<string, unknown> = {
        _gwtClass: className,
        _unknown: true,
      };
      this.objectTable.set(objectId, obj);
      return obj;
    }

    const obj: Record<string, unknown> = { _gwtClass: className };
    this.objectTable.set(objectId, obj);

    for (const field of fields) {
      obj[field.name] = this.readField(field.type);
    }

    return obj;
  }

  readArrayList(): Array<Record<string, unknown> | null> {
    const count = this.readInt();
    const items: Array<Record<string, unknown> | null> = [];
    for (let i = 0; i < count; i++) {
      items.push(this.readObject());
    }
    return items;
  }

  skip(count: number): void {
    this.pos += count;
  }
}

// --- Day Number Utilities ---

export function dateToDayNumber(date: Date): number {
  const msPerDay = 86_400_000;
  const utcDate = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const utcEpoch = Date.UTC(2000, 11, 31);
  return Math.round((utcDate - utcEpoch) / msPerDay);
}

export function dayNumberToDate(dayNumber: number): Date {
  const msPerDay = 86_400_000;
  const utcEpoch = Date.UTC(2000, 11, 31);
  return new Date(utcEpoch + dayNumber * msPerDay);
}

export function getTimezoneOffset(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(now);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  if (!tzPart) return -5;

  const match = tzPart.value.match(/GMT([+-]?\d+)/);
  if (!match?.[1]) return -5;
  return parseInt(match[1], 10);
}
