import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { columnData } from "@/types/column";
import {
  reorderWithinColumn,
  moveBetweenColumns,
  reorderColumnsList,
} from "@/utils/reorder";

type ColumnRow = { id: string; title: string; position: number };
type CardRow = { id: string; column_id: string; title: string; position: number };
type PersistResult = { error: { message: string } | null };

const assembleColumns = (columnRows: ColumnRow[], cardRows: CardRow[]): columnData[] =>
  columnRows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((col) => ({
      id: col.id,
      title: col.title,
      children: cardRows
        .filter((card) => card.column_id === col.id)
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((card) => ({ id: card.id, title: card.title })),
    }));

const useColumns = (userId: string) => {
  const [columns, setColumns] = useState<columnData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchColumns = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    const [columnsRes, cardsRes] = await Promise.all([
      supabase.from("columns").select("id, title, position").eq("user_id", userId).order("position"),
      supabase
        .from("cards")
        .select("id, column_id, title, position")
        .eq("user_id", userId)
        .order("position"),
    ]);

    if (columnsRes.error || cardsRes.error) {
      setLoadError((columnsRes.error ?? cardsRes.error)!.message);
      setLoading(false);
      return;
    }

    setColumns(assembleColumns(columnsRes.data ?? [], cardsRes.data ?? []));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchColumns();
  }, [fetchColumns]);

  const dismissError = () => setError(null);

  const withRollback = async (
    previousColumns: columnData[],
    optimisticColumns: columnData[],
    persist: () => Promise<PersistResult>
  ) => {
    setColumns(optimisticColumns);
    const { error: persistError } = await persist();
    if (persistError) {
      setColumns(previousColumns);
      setError(persistError.message);
    }
  };

  const addColumn = async (title: string) => {
    const tempId = crypto.randomUUID();
    const previousColumns = columns;
    setColumns([...columns, { id: tempId, title, children: [] }]);

    const { data, error: insertError } = await supabase
      .from("columns")
      .insert({ user_id: userId, title, position: previousColumns.length })
      .select("id")
      .single();

    if (insertError || !data) {
      setColumns(previousColumns);
      setError(insertError?.message ?? "Failed to create column");
      return;
    }

    setColumns((current) =>
      current.map((col) => (col.id === tempId ? { ...col, id: data.id } : col))
    );
  };

  const renameColumn = async (columnId: string, title: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.map((col) => (col.id === columnId ? { ...col, title } : col));
    await withRollback(previousColumns, optimisticColumns, async () =>
      supabase.from("columns").update({ title }).eq("id", columnId)
    );
  };

  const deleteColumn = async (columnId: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.filter((col) => col.id !== columnId);
    await withRollback(previousColumns, optimisticColumns, async () => {
      const { error: deleteError } = await supabase.from("columns").delete().eq("id", columnId);
      if (deleteError) return { error: deleteError };
      return persistColumnPositions(optimisticColumns);
    });
  };

  const addCard = async (columnId: string, title: string) => {
    const column = columns.find((col) => col.id === columnId);
    if (!column) return;

    const tempId = crypto.randomUUID();
    const previousColumns = columns;
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, children: [...col.children, { id: tempId, title }] } : col
      )
    );

    const { data, error: insertError } = await supabase
      .from("cards")
      .insert({ user_id: userId, column_id: columnId, title, position: column.children.length })
      .select("id")
      .single();

    if (insertError || !data) {
      setColumns(previousColumns);
      setError(insertError?.message ?? "Failed to create card");
      return;
    }

    setColumns((current) =>
      current.map((col) =>
        col.id === columnId
          ? { ...col, children: col.children.map((c) => (c.id === tempId ? { ...c, id: data.id } : c)) }
          : col
      )
    );
  };

  const renameCard = async (columnId: string, cardId: string, title: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.map((col) =>
      col.id === columnId
        ? { ...col, children: col.children.map((c) => (c.id === cardId ? { ...c, title } : c)) }
        : col
    );
    await withRollback(previousColumns, optimisticColumns, async () =>
      supabase.from("cards").update({ title }).eq("id", cardId)
    );
  };

  const deleteCard = async (columnId: string, cardId: string) => {
    const previousColumns = columns;
    const optimisticColumns = columns.map((col) =>
      col.id === columnId ? { ...col, children: col.children.filter((c) => c.id !== cardId) } : col
    );
    const remainingCards = optimisticColumns.find((col) => col.id === columnId)!.children;
    await withRollback(previousColumns, optimisticColumns, async () => {
      const { error: deleteError } = await supabase.from("cards").delete().eq("id", cardId);
      if (deleteError) return { error: deleteError };
      return persistCardPositions(remainingCards);
    });
  };

  const persistCardPositions = async (cards: { id: string }[]): Promise<PersistResult> => {
    const results = await Promise.all(
      cards.map((card, index) => supabase.from("cards").update({ position: index }).eq("id", card.id))
    );
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  };

  const persistColumnPositions = async (cols: { id: string }[]): Promise<PersistResult> => {
    const results = await Promise.all(
      cols.map((col, index) => supabase.from("columns").update({ position: index }).eq("id", col.id))
    );
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  };

  const reorderCardsWithinColumn = async (columnId: string, startIndex: number, endIndex: number) => {
    const previousColumns = columns;
    const optimisticColumns = reorderWithinColumn(columns, columnId, startIndex, endIndex);
    const column = optimisticColumns.find((col) => col.id === columnId)!;
    await withRollback(previousColumns, optimisticColumns, () => persistCardPositions(column.children));
  };

  const moveCardBetweenColumns = async (
    sourceColumnId: string,
    destColumnId: string,
    sourceIndex: number,
    destIndex: number
  ) => {
    const previousColumns = columns;
    const optimisticColumns = moveBetweenColumns(
      columns,
      sourceColumnId,
      destColumnId,
      sourceIndex,
      destIndex
    );
    const sourceColumn = optimisticColumns.find((col) => col.id === sourceColumnId)!;
    const destColumn = optimisticColumns.find((col) => col.id === destColumnId)!;
    const movedCard = destColumn.children[destIndex];

    await withRollback(previousColumns, optimisticColumns, async () => {
      const { error: moveError } = await supabase
        .from("cards")
        .update({ column_id: destColumnId })
        .eq("id", movedCard.id);
      if (moveError) return { error: moveError };

      const [sourceResult, destResult] = await Promise.all([
        persistCardPositions(sourceColumn.children),
        persistCardPositions(destColumn.children),
      ]);
      return { error: sourceResult.error ?? destResult.error };
    });
  };

  const reorderColumns = async (startIndex: number, endIndex: number) => {
    const previousColumns = columns;
    const optimisticColumns = reorderColumnsList(columns, startIndex, endIndex);
    await withRollback(previousColumns, optimisticColumns, () =>
      persistColumnPositions(optimisticColumns)
    );
  };

  return {
    columns,
    loading,
    error,
    loadError,
    dismissError,
    refetch: fetchColumns,
    addColumn,
    renameColumn,
    deleteColumn,
    addCard,
    renameCard,
    deleteCard,
    reorderCardsWithinColumn,
    moveCardBetweenColumns,
    reorderColumns,
  };
};

export default useColumns;
