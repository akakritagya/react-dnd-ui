export type columnItemData = {
  id: string;
  title: string;
};

export type columnData = {
  id: string;
  title: string;
  children: columnItemData[];
};

export type ColumnProps = {
  column: columnData;
  index: number;
  onRenameColumn: (columnId: string, title: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
  onRenameCard: (columnId: string, cardId: string, title: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export type ColumnItemsListProps = {
  items: columnItemData[];
  colId: string;
  onRenameCard: (columnId: string, cardId: string, title: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onAddCard: (columnId: string, title: string) => void;
};

export type ColumnItemProps = {
  item: columnItemData;
  index: number;
  onRename: (cardId: string, title: string) => void;
  onDelete: (cardId: string) => void;
};
