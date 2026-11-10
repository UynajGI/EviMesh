/** Short form of a stable id for running text: prefix plus 6, an ellipsis, last 4. */
export function shortId(value) {
  if (!value) return '';
  const underscore = value.indexOf('_');
  const head = underscore > 0 ? value.slice(0, underscore + 7) : value.slice(0, 7);
  return value.length > head.length + 4 ? `${head}…${value.slice(-4)}` : value;
}
