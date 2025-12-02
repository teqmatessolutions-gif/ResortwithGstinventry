import React from "react";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "../../../utils/currency";

const ItemsTable = ({ items, categories, onDelete }) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Department
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Stock
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Min Level
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Unit Price
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Total Value
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {items.length === 0 ? (
                        <tr>
                            <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                                No items found
                            </td>
                        </tr>
                    ) : (
                        items.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {item.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {item.category_name || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {item.department ? (
                                        <span className="px-2 py-1 text-xs font-semibold text-indigo-800 bg-indigo-100 rounded-full">
                                            {item.department}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    <span
                                        className={
                                            item.is_low_stock ? "text-red-600 font-semibold" : ""
                                        }
                                    >
                                        {item.current_stock} {item.unit}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {item.min_stock_level}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {formatCurrency(item.unit_price)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {formatCurrency(item.current_stock * item.unit_price)}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {item.is_low_stock ? (
                                        <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                                            Low Stock
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                                            In Stock
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <button
                                        onClick={() => onDelete(item.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ItemsTable;
