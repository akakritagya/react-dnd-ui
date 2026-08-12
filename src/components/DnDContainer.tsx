import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";

import Column from "./Column";
import AddColumnForm from "./AddColumnForm";
import EmptyState from "./EmptyState";
import ErrorBanner from "./ErrorBanner";
import useColumns from "@/hooks/useColumns";
import { useAuth } from "@/auth/AuthContext";

const DnDContainer = () => {
  const { user } = useAuth();
  const {
    columns,
    loading,
    error,
    dismissError,
    refetch,
    addColumn,
    renameColumn,
    deleteColumn,
    addCard,
    renameCard,
    deleteCard,
    reorderCardsWithinColumn,
    moveCardBetweenColumns,
    reorderColumns,
  } = useColumns(user!.id);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    if (type === "item") {
      if (source.droppableId === destination.droppableId) {
        reorderCardsWithinColumn(source.droppableId, source.index, destination.index);
      } else {
        moveCardBetweenColumns(
          source.droppableId,
          destination.droppableId,
          source.index,
          destination.index
        );
      }
      return;
    }

    if (type === "column") {
      reorderColumns(source.index, destination.index);
    }
  };

  if (loading) {
    return <p className="text-slate-400">Loading your board...</p>;
  }

  // error with zero columns means the initial fetch itself failed (a
  // successful fetch for a brand-new user still yields columns: [] with
  // error: null), so this is unambiguously the "retry the load" case.
  if (error && columns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-rose-600 text-sm">{error}</p>
        <button
          onClick={refetch}
          className="bg-indigo-600 text-white text-sm font-medium rounded-lg px-3 py-1.5 hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {error && <ErrorBanner message={error} onDismiss={dismissError} />}
      <DragDropContext onDragEnd={onDragEnd} key="drag-drop-context">
        <Droppable droppableId="container" key="container" direction="horizontal" type="column">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="w-full h-max flex justify-center flex-wrap gap-8 px-8"
            >
              {columns.map((column, index) => (
                <Column
                  key={column.id}
                  column={column}
                  index={index}
                  onRenameColumn={renameColumn}
                  onDeleteColumn={deleteColumn}
                  onAddCard={addCard}
                  onRenameCard={renameCard}
                  onDeleteCard={deleteCard}
                />
              ))}
              {provided.placeholder}
              <AddColumnForm onAddColumn={addColumn} />
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {columns.length === 0 && <EmptyState />}
    </div>
  );
};

export default DnDContainer;
