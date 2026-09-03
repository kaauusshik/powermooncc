export const clean = (values, { numbers = [], nulls = true, omit = [] } = {}) => {
  const out = {};
  Object.entries(values).forEach(([k, v]) => {
    if (omit.includes(k)) return;
    if (numbers.includes(k)) { out[k] = v === "" || v === null || v === undefined ? 0 : Number(v); return; }
    out[k] = v === "" && nulls ? null : v;
  });
  return out;
};
