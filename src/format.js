const currencies = new Map();
export function money(value, digits = 0) {
  if (!currencies.has(digits))
    currencies.set(
      digits,
      new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }),
    );
  return currencies.get(digits).format(digits === 0 ? Math.round(value) : value);
}
export const pounds = (value) =>
  value.toLocaleString('en-CA', { maximumFractionDigits: 0 }) + ' lb';
export const percent = (value) => Math.round(value * 100) + '%';
