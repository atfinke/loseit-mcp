import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseGwtResponse,
  GwtReader,
  GwtParseError,
  registerGwtType,
  dateToDayNumber,
  dayNumberToDate,
} from "./gwt.js";

describe("parseGwtResponse", () => {
  it("extracts string table, values, version, and flags", () => {
    const raw = '//OK[1,2,"hello",["str1","str2"],0,7]';
    const res = parseGwtResponse(raw);

    assert.equal(res.version, 7);
    assert.equal(res.flags, 0);
    assert.deepEqual(res.stringTable, ["str1", "str2"]);
    assert.deepEqual(res.values, [1, 2, "hello"]);
  });

  it("throws on //EX responses", () => {
    assert.throws(
      () => parseGwtResponse("//EX[some error]"),
      GwtParseError,
    );
  });

  it("throws on non-GWT responses", () => {
    assert.throws(
      () => parseGwtResponse("<html>not gwt</html>"),
      GwtParseError,
    );
  });
});

describe("GwtReader", () => {
  it("reads int, double, string, boolean sequentially", () => {
    const stringTable = ["hello", "world"];
    const values = [42, 3.14, 1, 2, 0];

    const reader = new GwtReader(values, stringTable);

    assert.equal(reader.readInt(), 42);
    assert.equal(reader.readDouble(), 3.14);
    assert.equal(reader.readString(), "hello");
    assert.equal(reader.readString(), "world");
    assert.equal(reader.readBoolean(), false);
  });

  it("returns null for string index 0", () => {
    const reader = new GwtReader([0], []);
    assert.equal(reader.readString(), null);
  });

  it("deserializes a registered object type", () => {
    registerGwtType("com.example.Simple", [
      { name: "count", type: "int" },
      { name: "label", type: "string" },
    ]);

    const stringTable = ["com.example.Simple/12345", "hello"];
    const values = [1, 5, 2];

    const reader = new GwtReader(values, stringTable);
    const obj = reader.readObject();

    assert.notEqual(obj, null);
    assert.equal(obj!["count"], 5);
    assert.equal(obj!["label"], "hello");
  });

  it("handles back-references with negative integers", () => {
    registerGwtType("com.example.BackRef", [
      { name: "value", type: "int" },
    ]);

    const stringTable = ["com.example.BackRef/111"];
    const values = [1, 42, -1];

    const reader = new GwtReader(values, stringTable);
    const first = reader.readObject();
    const second = reader.readObject();

    assert.equal(first!["value"], 42);
    assert.equal(second, first);
  });
});

describe("day number conversions", () => {
  it("converts 2026-04-02 to day 9223", () => {
    const date = new Date(2026, 3, 2);
    assert.equal(dateToDayNumber(date), 9223);
  });

  it("converts day 9223 back to 2026-04-02", () => {
    const date = dayNumberToDate(9223);
    assert.equal(date.getUTCFullYear(), 2026);
    assert.equal(date.getUTCMonth(), 3);
    assert.equal(date.getUTCDate(), 2);
  });

  it("converts 2001-01-01 to day 1", () => {
    const date = new Date(2001, 0, 1);
    assert.equal(dateToDayNumber(date), 1);
  });
});
