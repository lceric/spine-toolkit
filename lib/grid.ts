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

export type CellOverrides = Record<string, Rect>;

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const positiveInteger = (value: number) => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

export const getCellKey = (cell: Pick<GridCell, 'row' | 'col'>) => `${cell.row}:${cell.col}`;

export function getGridCells({
  originX,
  originY,
  cellWidth,
  cellHeight,
  gapX,
  gapY,
  rows,
  cols
}: GridSettings, cellOverrides: CellOverrides = {}): GridCell[] {
  const safeRows = positiveInteger(rows);
  const safeCols = positiveInteger(cols);
  const safeCellWidth = Math.max(1, cellWidth);
  const safeCellHeight = Math.max(1, cellHeight);
  const cells: GridCell[] = [];

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      const baseCell = {
        row,
        col,
        x: originX + col * (safeCellWidth + gapX),
        y: originY + row * (safeCellHeight + gapY),
        width: safeCellWidth,
        height: safeCellHeight
      };
      const override = cellOverrides[getCellKey(baseCell)];

      cells.push({
        ...baseCell,
        ...override,
        width: Math.max(1, override?.width ?? baseCell.width),
        height: Math.max(1, override?.height ?? baseCell.height)
      });
    }
  }

  return cells;
}

export function getGridBounds(settings: GridSettings): Rect {
  const safeRows = positiveInteger(settings.rows);
  const safeCols = positiveInteger(settings.cols);
  const safeCellWidth = Math.max(1, settings.cellWidth);
  const safeCellHeight = Math.max(1, settings.cellHeight);

  return {
    x: settings.originX,
    y: settings.originY,
    width: safeCols * safeCellWidth + Math.max(0, safeCols - 1) * settings.gapX,
    height: safeRows * safeCellHeight + Math.max(0, safeRows - 1) * settings.gapY
  };
}
