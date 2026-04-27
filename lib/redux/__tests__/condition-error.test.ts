import { describe, it, expect } from "vitest";
import {
  isConditionError,
  messageFromRejection,
} from "@/lib/redux/condition-error";

describe("isConditionError", () => {
  it("returns true for the RTK ConditionError shape", () => {
    expect(
      isConditionError({
        name: "ConditionError",
        message: "Aborted due to condition callback returning false.",
      }),
    ).toBe(true);
  });

  it("returns true for the minimal ConditionError shape (no message)", () => {
    expect(isConditionError({ name: "ConditionError" })).toBe(true);
  });

  it("returns false for an Error instance with name='ConditionError'", () => {
    // Edge case: actual Error instances can have name set, but RTK throws plain
    // objects. Both should match for safety since the discriminator is `.name`.
    const err = new Error("blah");
    err.name = "ConditionError";
    expect(isConditionError(err)).toBe(true);
  });

  it("returns false for a plain string", () => {
    expect(isConditionError("Some error message")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isConditionError(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isConditionError(undefined)).toBe(false);
  });

  it("returns false for an object with a different name", () => {
    expect(isConditionError({ name: "TypeError", message: "x" })).toBe(false);
  });

  it("returns false for an object without a name property", () => {
    expect(isConditionError({ message: "no name" })).toBe(false);
  });

  it("returns false for an Error instance with default name", () => {
    expect(isConditionError(new Error("regular error"))).toBe(false);
  });
});

describe("messageFromRejection", () => {
  it("returns Error.message when given an Error", () => {
    expect(messageFromRejection(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the string as-is when given a string", () => {
    expect(messageFromRejection("rejected with value", "fallback")).toBe(
      "rejected with value",
    );
  });

  it("returns the fallback when given null", () => {
    expect(messageFromRejection(null, "Action failed")).toBe("Action failed");
  });

  it("returns the fallback when given undefined", () => {
    expect(messageFromRejection(undefined, "Action failed")).toBe(
      "Action failed",
    );
  });

  it("returns the fallback when given a plain object without a message", () => {
    expect(messageFromRejection({ name: "ConditionError" }, "fallback")).toBe(
      "fallback",
    );
  });

  it("returns the fallback when given a number", () => {
    expect(messageFromRejection(42, "fallback")).toBe("fallback");
  });
});
