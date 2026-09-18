const { computeLineAmount, computeGrandTotal } = require("../src/utils/calc");

describe("Quotation total calculation", () => {
  test("Test 1: a single line item is calculated correctly (discount then GST)", () => {
    // Qty 10 x 100 = 1000 base
    // 10% discount -> 900
    // 18% GST on 900 -> 1062
    const amount = computeLineAmount({ quantity: 10, unitPrice: 100, discountPct: 10, gstPct: 18 });
    expect(amount).toBeCloseTo(1062, 2);
  });

  test("Test 1b: grand total sums multiple line items correctly", () => {
    const items = [
      { quantity: 10, unitPrice: 100, discountPct: 10, gstPct: 18 }, // 1062
      { quantity: 5, unitPrice: 200, discountPct: 0, gstPct: 18 }, // 1180
    ];
    const total = computeGrandTotal(items);
    expect(total).toBeCloseTo(2242, 2);
  });

  test("Test 1c: zero discount and zero GST returns the base amount", () => {
    const amount = computeLineAmount({ quantity: 3, unitPrice: 50, discountPct: 0, gstPct: 0 });
    expect(amount).toBe(150);
  });
});
