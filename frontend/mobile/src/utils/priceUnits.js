function convertPriceUnit(value, from, to) {
  if (!value || from === to) return value;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return value;
  if (from === 'KG' && to === 'QUINTAL') return String(Math.round(number * 100 * 100) / 100);
  if (from === 'QUINTAL' && to === 'KG') return String(Math.round((number / 100) * 10000) / 10000);
  return value;
}
module.exports = { convertPriceUnit };
