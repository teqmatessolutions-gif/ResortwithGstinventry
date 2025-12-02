import React from "react";
import { formatDateIST } from "../../../utils/dateUtils";

const CategoriesTable = ({ categories }) => {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Description
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Created
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {categories.length === 0 ? (
                        <tr>
                            <td colSpan="3" className="px-4 py-8 text-center text-gray-500">
                                No categories found
                            </td>
                        </tr>
                    ) : (
                        categories.map((cat) => (
                            <tr key={cat.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {cat.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {cat.description || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                    {formatDateIST(cat.created_at)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default CategoriesTable;
