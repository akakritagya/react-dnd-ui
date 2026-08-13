import React, { useState } from "react";
import { Droppable } from "@hello-pangea/dnd";

import ColumnItem from "./ColumnItem";
import { ColumnItemsListProps } from "@/types/column";

const ColumnItemsList: React.FC<ColumnItemsListProps> = ({
  items,
  colId,
  onRenameCard,
  onDeleteCard,
  onAddCard,
}) => {
  const [newCardTitle, setNewCardTitle] = useState("");

  const handleAddCard = () => {
    const trimmed = newCardTitle.trim();
    if (!trimmed) return;
    onAddCard(colId, trimmed);
    setNewCardTitle("");
  };

  return (
    <Droppable droppableId={colId} key={colId} type="item">
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex flex-col gap-3 p-4 transition-colors ease-in duration-150 ${
            snapshot.isDraggingOver ? "bg-indigo-50" : "bg-white"
          }`}
        >
          {items.map((item, index) => (
            <ColumnItem
              key={item.id}
              item={item}
              index={index}
              onRename={(cardId, title) => onRenameCard(colId, cardId, title)}
              onDelete={(cardId) => onDeleteCard(colId, cardId)}
            />
          ))}
          {provided.placeholder}
          <div className="flex gap-2">
            <input
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCard()}
              placeholder="Add a card"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={handleAddCard}
              className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </Droppable>
  );
};

export default ColumnItemsList;
