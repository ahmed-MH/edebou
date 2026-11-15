import type {
  AdminTableAlignment,
  AdminTableProps,
} from "@/types/admin-ui";

import { mergeClassNames } from "./class-names";

const alignmentClasses: Record<AdminTableAlignment, string> = {
  center: "text-center",
  end: "text-end",
  start: "text-start",
};

export function AdminTable<RowData>({
  caption,
  captionHidden = false,
  className,
  columns,
  emptyState,
  getRowKey,
  rows,
}: AdminTableProps<RowData>) {
  return (
    <div
      className={mergeClassNames(
        "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption
            className={mergeClassNames(
              "px-5 py-4 text-start text-base font-semibold text-zinc-950",
              captionHidden && "sr-only",
            )}
          >
            {caption}
          </caption>
          <thead className="border-y border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={mergeClassNames(
                    "whitespace-nowrap px-5 py-3",
                    alignmentClasses[column.align ?? "start"],
                    column.headerClassName,
                  )}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)}
                className="transition-colors hover:bg-zinc-50/80"
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={mergeClassNames(
                      "px-5 py-4 text-zinc-700",
                      alignmentClasses[column.align ?? "start"],
                      column.cellClassName,
                    )}
                  >
                    {column.cell(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && emptyState ? (
              <tr>
                <td className="px-5 py-12 text-center" colSpan={columns.length}>
                  {emptyState}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
