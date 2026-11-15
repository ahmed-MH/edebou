import type { LucideIcon } from "lucide-react";
import type { Key, ReactNode } from "react";

export type AdminIcon = LucideIcon;

export interface AdminNavigationItem {
  badge?: ReactNode;
  current?: boolean;
  href: string;
  icon?: AdminIcon;
  id: string;
  label: string;
}

export interface AdminNavigationGroup {
  id: string;
  items: readonly AdminNavigationItem[];
  label: string;
}

export type AdminStatTone = "brand" | "neutral" | "positive" | "warning";

export type AdminTableAlignment = "start" | "center" | "end";

export interface AdminTableColumn<RowData> {
  align?: AdminTableAlignment;
  cell: (row: RowData, rowIndex: number) => ReactNode;
  cellClassName?: string;
  header: ReactNode;
  headerClassName?: string;
  id: string;
}

export interface AdminTableProps<RowData> {
  caption: ReactNode;
  captionHidden?: boolean;
  className?: string;
  columns: readonly AdminTableColumn<RowData>[];
  emptyState?: ReactNode;
  getRowKey: (row: RowData, rowIndex: number) => Key;
  rows: readonly RowData[];
}
