import { describe, expect, it } from "vitest";

import { comboPartsLabel, comboPriceLabel } from "./comboLabels";

/** How the offers table names a combo: its parts, and one price for the set. */
describe("combo labels", () => {
  const slots = [
    { position: 1, dessert: null, category: { name: "Sago Series", chineseName: "西米露系列" } },
    { position: 0, dessert: { name: "Taro Mochi Bowl", chineseName: "芋泥麻糬" }, category: null },
  ];

  it("names the parts in order, in the admin's language", () => {
    expect(comboPartsLabel(slots, "en")).toBe("Combo: Taro Mochi Bowl + Sago Series");
    expect(comboPartsLabel(slots, "zh")).toBe("套餐：芋泥麻糬 + 西米露系列");
  });

  // Counted rather than named, as a category offer's are in the same column.
  it("counts what a category part leaves out, and nothing on a dessert part", () => {
    const leaving = [
      { ...slots[0]!, excludedDessertIds: ["durian", "lychee"] },
      { ...slots[1]!, excludedDessertIds: ["taro"] },
    ];
    expect(comboPartsLabel(leaving, "en")).toBe(
      "Combo: Taro Mochi Bowl + Sago Series (except 2 items)",
    );
    expect(comboPartsLabel(leaving, "zh")).toBe("套餐：芋泥麻糬 + 西米露系列（不含 2 项）");
    expect(
      comboPartsLabel([{ ...slots[0]!, excludedDessertIds: ["durian"] }, slots[1]!], "en"),
    ).toBe("Combo: Taro Mochi Bowl + Sago Series (except 1 item)");
  });

  it("prices the set, and says free for nothing", () => {
    expect(comboPriceLabel(1500, "en")).toBe("$15.00 combo");
    expect(comboPriceLabel(1500, "zh")).toBe("套餐价 $15.00");
    expect(comboPriceLabel(0, "en")).toBe("Free combo");
    expect(comboPriceLabel(0, "zh")).toBe("免费套餐");
  });
});
