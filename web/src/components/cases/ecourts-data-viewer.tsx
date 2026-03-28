"use client";

import { ChevronDown, ChevronRight, FileText, Gavel, LucideIcon } from "lucide-react";
import { useState } from "react";

type OrderEntry = {
  order_no?: string | number;
  date?: string;
  details?: string;
};

type ECourtsMetadata = {
  interim_orders?: OrderEntry[];
  final_orders?: OrderEntry[];
  [key: string]: unknown;
};

interface ECourtsDataViewerProps {
  metadata: ECourtsMetadata | null;
}

interface SectionHeaderProps {
  id: string;
  title: string;
  icon: LucideIcon;
  count?: number;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

function SectionHeader({ id, title, icon: Icon, count, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors text-left"
    >
      <div className="flex items-center gap-2 font-semibold text-gray-800">
        <Icon className="h-5 w-5 text-teal-600" />
        {title}
        {count !== undefined && (
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-2">
            {count}
          </span>
        )}
      </div>
      {isOpen ? (
        <ChevronDown className="h-4 w-4 text-gray-400" />
      ) : (
        <ChevronRight className="h-4 w-4 text-gray-400" />
      )}
    </button>
  );
}

export default function ECourtsDataViewer({ metadata }: ECourtsDataViewerProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    orders: true,
    raw: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!metadata) return null;

  const { interim_orders, final_orders } = metadata;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-gray-50/50">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          eCourts Record
        </h2>
        <p className="text-sm text-gray-500">Synced data from the official portal</p>
      </div>

      {((interim_orders && interim_orders.length > 0) ||
        (final_orders && final_orders.length > 0)) && (
        <div>
          <SectionHeader
            id="orders"
            title="Orders & Judgments"
            icon={Gavel}
            count={(interim_orders?.length || 0) + (final_orders?.length || 0)}
            isOpen={!!openSections.orders}
            onToggle={toggleSection}
          />
          {openSections.orders && (
            <div className="p-4 space-y-4 bg-white">
              {final_orders?.length ? (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                    Final Judgments
                  </h4>
                  <ul className="space-y-2">
                    {final_orders.map((o: OrderEntry, i: number) => (
                      <li
                        key={i}
                        className="flex justify-between items-center bg-gray-50 p-2 rounded border"
                      >
                        <span className="font-medium">
                          Order #{o.order_no ?? "-"} ({o.date ?? "-"})
                        </span>
                        <span className="text-sm text-gray-500">{o.details ?? "-"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {interim_orders?.length ? (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                    Interim Orders
                  </h4>
                  <ul className="space-y-2">
                    {interim_orders.map((o: OrderEntry, i: number) => (
                      <li
                        key={i}
                        className="flex justify-between items-center bg-gray-50 p-2 rounded border border-dashed"
                      >
                        <span className="font-medium text-sm">
                          Order #{o.order_no ?? "-"} ({o.date ?? "-"})
                        </span>
                        <span className="text-xs text-gray-500">{o.details ?? "-"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div>
        <SectionHeader
          id="raw"
          title="Raw JSON Data"
          icon={FileText}
          isOpen={!!openSections.raw}
          onToggle={toggleSection}
        />
        {openSections.raw && (
          <div className="bg-gray-900 p-4 text-xs font-mono text-gray-300 overflow-auto max-h-60 m-4 rounded-lg">
            <pre>{JSON.stringify(metadata, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
