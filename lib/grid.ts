export type GridSettings = {
  originX: number;
  originY: number;
  cellWidth: number;
  cellHeight: number;
  gapX: number;
  gapY: number;
  rows: number;
  cols: number;
};

export type GridCell = {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

const positiveInteger = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

export function getGridCells({
  originX,
  originY,
  cellWidth,
  cellHeight,
  gapX,
  gapY,
  rows,
  cols
}: GridSettings): GridCell[] {
  const safeRows = positiveInteger(rows);
  const safeCols = positiveInteger(cols);
  const safeCellWidth = Math.max(1, cellWidth);
  const safeCellHeight = Math.max(1, cellHeight);
  const cells: GridCell[] = [];

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      cells.push({
        row,
        col,
        x: originX + col * (safeCellWidth + gapX),
        y: originY + row * (safeCellHeight + gapY),
        width: safeCellWidth,
        height: safeCellHeight
      });
    }
  }

  return cells;
}
