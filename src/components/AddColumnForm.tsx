import React, { useState } from "react";

type AddColumnFormProps = {
  onAddColumn: (title: string) => void;
};

const AddColumnForm: React.FC<AddColumnFormProps> = ({ onAddColumn }) => {
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddColumn(trimmed);
    setTitle("");
  };

  return (
    <div className="w-72 h-max flex flex-col gap-2 p-4 border-2 border-dashed border-slate-300 rounded-xl">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="New column title"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
      <button
        onClick={handleSubmit}
        className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
      >
        Add column
      </button>
    </div>
  );
};

export default AddColumnForm;
