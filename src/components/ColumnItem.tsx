import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";

import { ColumnItemProps } from "@/types/column";

const ColumnItem: React.FC<ColumnItemProps> = ({ item, index, onRename, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  const commitRename = () => {
    setIsEditing(false);
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      onRename(item.id, trimmed);
    } else {
      setTitle(item.title);
    }
  };

  return (
    <Draggable draggableId={item.id} index={index} key={item.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`group w-60 flex items-center justify-between gap-2 px-4 py-3 border rounded-lg font-medium transition-colors ease-in duration-150 ${
            snapshot.isDragging
              ? "border-indigo-400 ring-2 ring-indigo-400 shadow-md bg-white"
              : "border-slate-200 bg-white hover:border-indigo-300"
          }`}
        >
          <div {...provided.dragHandleProps} className="flex-1 cursor-grab min-w-0">
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
                    setTitle(item.title);
                    setIsEditing(false);
                  }
                }}
                className="w-full border border-indigo-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            ) : (
              <span onClick={() => setIsEditing(true)} className="block truncate">
                {item.title}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${item.title}"?`)) {
                onDelete(item.id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
            aria-label="Delete card"
          >
            ×
          </button>
        </div>
      )}
    </Draggable>
  );
};

export default ColumnItem;
