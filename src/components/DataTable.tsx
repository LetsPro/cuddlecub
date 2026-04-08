import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  emptyMessage: string;
}

export function DataTable<T>({ columns, rows, emptyMessage }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-100">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-sm text-slate-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index} className="align-top">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4 text-sm text-slate-700">
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
