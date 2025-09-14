import React from "react";
import type { PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface PurchaseProps {
  id: string;
  pageData: PageData;
  handleChange?: (
    key: keyof PageData,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  readOnly?: boolean;
}

const Purchase: React.FC<PurchaseProps> = ({
  id,
  pageData,
  handleChange,
  readOnly = false,
}) => {
  return (
    <SortableCard id={id} disabled={readOnly}>
      <div className="col-span-2 bg-slate-700 rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4">
          Get {pageData.gameInfoTitle || "this game"}
        </h3>

        <div className="flex items-center space-x-4">
          <button
            type="button"
            className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded font-semibold"
            disabled={readOnly}
          >
            Buy Now
          </button>

          <div className="text-white">
            {readOnly ? (
              <span className="text-2xl font-bold">
                {pageData.price || "$0.00"}
              </span>
            ) : (
              <input
                type="text"
                className="text-2xl font-bold bg-transparent outline-none w-auto text-white"
                value={pageData.price}
                onChange={(e) => handleChange("price", e)}
              />
            )}
          </div>
        </div>
      </div>
    </SortableCard>
  );
};

export default Purchase;
