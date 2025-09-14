import React from "react";
import type { PageData } from "../../types/Devlogs";
import SortableCard from "../Home/SortableCard";

interface PurchaseProps {
  id: string;
  pageData: PageData;
  handleChange: (key: keyof PageData, e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Purchase: React.FC<PurchaseProps> = ({id, pageData, handleChange }) => {

  return (
      <SortableCard id={id}>
     <div className="col-span-2 bg-slate-700 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-white mb-4">
                  Get {pageData.gameInfoTitle}
                </h3>
                 <div className="flex items-center space-x-4">
                  <button type="button" className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded font-semibold">
                    Buy Now
                  </button>
                  <div className="text-white">
                    <input
                      type="text"
                      className="text-2xl font-bold bg-transparent outline-none w-[auto] text-white"
                      value={pageData.price}
                      onChange={(e) => handleChange("price", e)}
                    />
                    {/* <span className="text-slate-400 ml-2">or more</span> */}
                  </div>
                </div>
              </div>
      </SortableCard>
          
  );
};

export default Purchase;
