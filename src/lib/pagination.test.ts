import { decodeCursor, encodeCursor } from "@/lib/pagination";

describe("pagination cursor helpers", () => {
  it("round-trips valid cursors", () => {
    const encoded = encodeCursor({
      createdAt: "2026-03-09T12:00:00.000Z",
      id: "listing_1",
    });

    expect(decodeCursor(encoded)).toEqual({
      createdAt: "2026-03-09T12:00:00.000Z",
      id: "listing_1",
    });
  });

  it("returns null for malformed cursors", () => {
    expect(decodeCursor("not_base64")).toBeNull();
  });
});
