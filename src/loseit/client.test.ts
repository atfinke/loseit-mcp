import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  isSessionRejected,
  describeFailure,
  LoseItApiError,
  LoseItNetworkError,
} from "./client.js";
import { GwtParseError } from "./gwt.js";

const apiError = (status: number) =>
  new LoseItApiError(`failed with ${status}`, status, "https://api.loseit.com/x", "");

describe("isSessionRejected", () => {
  it("treats 401 and 403 as a rejected session", () => {
    assert.equal(isSessionRejected(apiError(401)), true);
    assert.equal(isSessionRejected(apiError(403)), true);
  });

  // The regression this guards: initialize() used to catch every error and
  // re-authenticate. A 429 on the session check then triggered a login that
  // was itself rate-limited, so a transient throttle killed startup outright.
  it("does not treat rate limiting as a rejected session", () => {
    assert.equal(isSessionRejected(apiError(429)), false);
  });

  it("does not treat server or transport failures as a rejected session", () => {
    assert.equal(isSessionRejected(apiError(500)), false);
    assert.equal(isSessionRejected(apiError(503)), false);
    assert.equal(
      isSessionRejected(
        new LoseItNetworkError("boom", "https://api.loseit.com/x", new Error("ECONNRESET")),
      ),
      false,
    );
    assert.equal(isSessionRejected(new GwtParseError("bad body")), false);
  });

  it("does not treat unknown throwables as a rejected session", () => {
    assert.equal(isSessionRejected(new Error("nope")), false);
    assert.equal(isSessionRejected("nope"), false);
    assert.equal(isSessionRejected(undefined), false);
  });
});

describe("describeFailure", () => {
  it("names the status for API errors", () => {
    assert.equal(describeFailure(apiError(429)), "HTTP 429");
  });

  it("names the class of non-API failures", () => {
    assert.equal(
      describeFailure(
        new LoseItNetworkError("boom", "https://api.loseit.com/x", new Error("ECONNRESET")),
      ),
      "network error",
    );
    assert.equal(describeFailure(new GwtParseError("bad body")), "unparseable response");
    assert.equal(describeFailure(new TypeError("x")), "TypeError");
    assert.equal(describeFailure(42), "unknown error");
  });
});
