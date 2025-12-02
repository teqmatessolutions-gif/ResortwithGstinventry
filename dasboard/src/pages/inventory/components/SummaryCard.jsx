import React from "react";

const SummaryCard = ({ label, value, icon, color, highlight }) => {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600",
        red: "bg-red-50 text-red-600",
        green: "bg-green-50 text-green-600",
        purple: "bg-purple-50 text-purple-600",
        indigo: "bg-indigo-50 text-indigo-600",
        teal: "bg-teal-50 text-teal-600",
        orange: "bg-orange-50 text-orange-600",
    };

    return (
        <div
            className={`bg-white rounded-xl shadow-sm border-2 p-4 ${highlight ? "border-red-300" : "border-gray-100"}`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600">{label}</p>
                    <p className={`text-2xl font-bold mt-1 ${colorClasses[color]}`}>
                        {value}
                    </p>
                </div>
                <div className={colorClasses[color] + " p-3 rounded-lg"}>{icon}</div>
            </div>
        </div>
    );
};

export default SummaryCard;
