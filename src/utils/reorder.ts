import { columnData } from "@/types/column";

export const reorderWithinColumn = (
  columns: columnData[],
  columnId: string,
  startIndex: number,
  endIndex: number
): columnData[] => {
  return columns.map((column) => {
    if (column.id !== columnId) return column;
    const children = [...column.children];
    const [moved] = children.splice(startIndex, 1);
    children.splice(endIndex, 0, moved);
    return { ...column, children };
  });
};

export const moveBetweenColumns = (
  columns: columnData[],
  sourceColumnId: string,
  destColumnId: string,
  sourceIndex: number,
  destIndex: number
): columnData[] => {
  const sourceColumn = columns.find((column) => column.id === sourceColumnId);
  if (!sourceColumn) return columns;

  const sourceChildren = [...sourceColumn.children];
  const [moved] = sourceChildren.splice(sourceIndex, 1);

  return columns.map((column) => {
    if (column.id === sourceColumnId) {
      const children = [...sourceChildren];
      if (column.id === destColumnId) {
        children.splice(destIndex, 0, moved);
      }
      return { ...column, children };
    }
    if (column.id === destColumnId) {
      const children = [...column.children];
      children.splice(destIndex, 0, moved);
      return { ...column, children };
    }
    return column;
  });
};

export const reorderColumnsList = (
  columns: columnData[],
  startIndex: number,
  endIndex: number
): columnData[] => {
  const result = [...columns];
  const [moved] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, moved);
  return result;
};
