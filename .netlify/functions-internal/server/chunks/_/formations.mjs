const FORMATION_DEFINITIONS = [
  { code: "442", rows: [4, 4, 2] },
  { code: "433", rows: [4, 3, 3] },
  { code: "451", rows: [4, 5, 1] },
  { code: "352", rows: [3, 5, 2] },
  { code: "343", rows: [3, 4, 3] },
  { code: "541", rows: [5, 4, 1] },
  { code: "532", rows: [5, 3, 2] }
];
const ROW_Y = {
  GK: 92,
  DEF: 70,
  MID: 46,
  FWD: 18
};
function spreadX(count) {
  return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1) * 100);
}
function sideForIndex(index, count) {
  if (count <= 1) {
    return "Center";
  }
  if (index === 0) {
    return "Left";
  }
  if (index === count - 1) {
    return "Right";
  }
  return "Center";
}
function buildSlots(rows) {
  const [defCount, midCount, fwdCount] = rows;
  const slots = [{ id: "gk", group: "GK", x: 50, y: ROW_Y.GK, side: "Center", rowSize: 1 }];
  const addRow = (group, count) => {
    spreadX(count).forEach((x, index) => {
      slots.push({
        id: `${group.toLowerCase()}-${index + 1}`,
        group,
        rowSize: count,
        side: sideForIndex(index, count),
        x,
        y: ROW_Y[group]
      });
    });
  };
  addRow("DEF", defCount);
  addRow("MID", midCount);
  addRow("FWD", fwdCount);
  return slots;
}
const formations = FORMATION_DEFINITIONS.map(({ code, rows }) => ({
  code,
  target: Number(code),
  rows,
  slots: buildSlots(rows)
}));
function getFormation(code) {
  return formations.find((formation) => formation.code === code);
}

export { getFormation as g };
//# sourceMappingURL=formations.mjs.map
