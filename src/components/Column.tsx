import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";

import { ColumnProps } from "@/types/column";
import ColumnItemsList from "./ColumnItemsList";

const Column: React.FC<ColumnProps> = ({
  column,
  index,
  onRenameColumn,
  onDeleteColumn,
  onAddCard,
  onRenameCard,
  onDeleteCard,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);

  const commitRename = () => {
    setIsEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== column.title) {
      onRenameColumn(column.id, trimmed);
    } else {
      setTitle(column.title);
    }
  };

  return (
    <Draggable draggableId={column.id} index={index} key={column.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group w-72 h-max bg-white border rounded-xl shadow-sm transition-colors ease-in duration-150 ${
            snapshot.isDragging ? "border-indigo-400 ring-2 ring-indigo-400" : "border-slate-200"
          }`}
        >
          <div
            {...provided.dragHandleProps}
            className="flex items-center justify-between px-4 py-3 border-b border-slate-200 cursor-grab"
          >
            {isEditing ? (
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") {
                    setTitle(column.title);
                    setIsEditing(false);
                  }
                }}
                className="flex-1 border border-indigo-300 rounded px-1 py-0.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <h2
                onClick={() => setIsEditing(true)}
                className="flex-1 font-semibold text-slate-700 truncate"
              >
                {column.title}
              </h2>
            )}
            <button
              onClick={() => {
                if (window.confirm(`Delete "${column.title}" and all its cards?`)) {
                  onDeleteColumn(column.id);
                }
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity ml-2"
              aria-label="Delete column"
            >
              ×
            </button>
          </div>
          <ColumnItemsList
            items={column.children}
            colId={column.id}
            onRenameCard={onRenameCard}
            onDeleteCard={onDeleteCard}
            onAddCard={onAddCard}
          />
        </div>
      )}
    </Draggable>
  );
};

export default Column;
