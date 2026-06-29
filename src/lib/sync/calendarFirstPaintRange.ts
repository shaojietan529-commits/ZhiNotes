export interface CalendarMonthCell {
  date: Date;
  inMonth: boolean;
}

export interface CalendarFirstPaintRange {
  grid: CalendarMonthCell[];
  startDate: string;
  endDate: string;
  cacheKey: string;
}

type DateKeyFormatter = (date: Date) => string;

// Shared 6-week, Monday-first calendar window used by metadata-first modules.
export function buildCalendarMonthGrid(monthStart: Date): CalendarMonthCell[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offset);
  const cells: CalendarMonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    cells.push({ date, inMonth: date.getMonth() === month });
  }
  return cells;
}

export function buildCalendarFirstPaintRange(
  monthStart: Date,
  toDateKey: DateKeyFormatter
): CalendarFirstPaintRange {
  const grid = buildCalendarMonthGrid(monthStart);
  const startDate = toDateKey(grid[0].date);
  const endDate = toDateKey(grid[grid.length - 1].date);
  return {
    grid,
    startDate,
    endDate,
    cacheKey: buildDateRangeCacheKey(startDate, endDate),
  };
}

export function buildDateRangeCacheKey(
  startDate: string,
  endDate: string
): string {
  return `${startDate}:${endDate}`;
}
