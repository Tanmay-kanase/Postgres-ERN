// Simple, readable document-number generator: PREFIX-YYYYMMDD-XXXX (random 4 digits).
// Uniqueness is ultimately guarded by the DB's unique constraint; on the rare collision
// the caller should retry (handled in controllers via a small retry loop).
function generateNumber(prefix) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${y}${m}${d}-${rand}`;
}

module.exports = { generateNumber };
