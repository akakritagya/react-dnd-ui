import { describe, expect, it } from "vitest";
import {
  reorderWithinColumn,
  moveBetweenColumns,
  reorderColumnsList,
} from "./reorder";
import { columnData } from "@/types/column";

const makeColumns = (): columnData[] => [
  {
    id: "col-a",
    title: "Column A",
    children: [
      { id: "a1", title: "A1" },
      { id: "a2", title: "A2" },
      { id: "a3", title: "A3" },
    ],
  },
  {
    id: "col-b",
    title: "Column B",
    children: [
      { id: "b1", title: "B1" },
      { id: "b2", title: "B2" },
    ],
  },
];

describe("reorderWithinColumn", () => {
  it("moves a card to a new index within the same column", () => {
    const result = reorderWithinColumn(makeColumns(), "col-a", 0, 2);
    expect(result.find((c) => c.id === "col-a")!.children.map((c) => c.id)).toEqual([
      "a2",
      "a3",
      "a1",
    ]);
  });

  it("does not mutate other columns", () => {
    const original = makeColumns();
    const result = reorderWithinColumn(original, "col-a", 0, 2);
    expect(result.find((c) => c.id === "col-b")).toEqual(original[1]);
  });

  it("does not mutate the input array", () => {
    const original = makeColumns();
    const originalOrder = original.find((c) => c.id === "col-a")!.children.map((c) => c.id);
    reorderWithinColumn(original, "col-a", 0, 2);
    expect(original.find((c) => c.id === "col-a")!.children.map((c) => c.id)).toEqual(
      originalOrder
    );
  });
});

describe("moveBetweenColumns", () => {
  it("moves a card from one column to another at the given index", () => {
    const result = moveBetweenColumns(makeColumns(), "col-a", "col-b", 1, 0);
    expect(result.find((c) => c.id === "col-a")!.children.map((c) => c.id)).toEqual([
      "a1",
      "a3",
    ]);
    expect(result.find((c) => c.id === "col-b")!.children.map((c) => c.id)).toEqual([
      "a2",
      "b1",
      "b2",
    ]);
  });
});

describe("reorderColumnsList", () => {
  it("moves a column to a new index", () => {
    const result = reorderColumnsList(makeColumns(), 0, 1);
    expect(result.map((c) => c.id)).toEqual(["col-b", "col-a"]);
  });
});
