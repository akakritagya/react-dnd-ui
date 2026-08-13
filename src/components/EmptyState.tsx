import React from "react";

const EmptyState: React.FC = () => (
  <div className="w-full max-w-md flex flex-col items-center gap-2 text-center py-12 border-2 border-dashed border-slate-300 rounded-xl text-slate-400">
    <p className="font-medium">No columns yet</p>
    <p className="text-sm">Create your first column to start organizing tasks.</p>
  </div>
);

export default EmptyState;
