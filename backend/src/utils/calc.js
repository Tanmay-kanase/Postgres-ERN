// All money math lives here so the backend is always the source of truth for totals.
// The frontend may show a live preview, but the server recomputes and never trusts
// a client-submitted total.

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * item: { quantity, unitPrice, discountPct, gstPct }
 * Base Amount = Quantity * UnitPrice
 * Discount applied first, then GST on the discounted amount.
 */
function computeLineAmount(item) {
  const qty = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  const discountPct = Number(item.discountPct || 0);
  const gstPct = Number(item.gstPct || 0);

  const baseAmount = qty * unitPrice;
  const afterDiscount = baseAmount - (baseAmount * discountPct) / 100;
  const afterGst = afterDiscount + (afterDiscount * gstPct) / 100;

  return round2(afterGst);
}

function computeGrandTotal(items) {
  const total = items.reduce((sum, item) => sum + computeLineAmount(item), 0);
  return round2(total);
}

module.exports = { computeLineAmount, computeGrandTotal, round2 };
