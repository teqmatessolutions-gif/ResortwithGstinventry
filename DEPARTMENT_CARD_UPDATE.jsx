/**
 * COMPLETE SOLUTION: Department Card with Expense Breakdown
 * 
 * FILE: c:\releasing\orchid\dasboard\src\pages\Account.jsx
 * LOCATION: Lines 950-986 (inside the department_kpis map)
 * 
 * INSTRUCTIONS:
 * 1. Open Account.jsx in your editor
 * 2. Find the section that starts with: <div className="space-y-3">
 * 3. This is around line 950, inside the department cards loop
 * 4. Replace the ENTIRE <div className="space-y-3">...</div> section
 * 5. With the code below (between the START and END markers)
 */

// ==================== START: REPLACE FROM HERE ====================
<div className="space-y-2">
    {/* Assets */}
    <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 flex items-center gap-2">
            <TrendingUp className="text-green-500 w-4 h-4" />
            Assets
        </span>
        <span className="text-md font-bold text-green-600">
            ₹<CountUp end={data.assets || 0} duration={1.5} decimals={2} separator="," />
        </span>
    </div>

    {/* Income */}
    <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 flex items-center gap-2">
            <ArrowUpDown className="text-blue-500 w-4 h-4" />
            Income
        </span>
        <span className="text-md font-bold text-blue-600">
            ₹<CountUp end={data.income || 0} duration={1.5} decimals={2} separator="," />
        </span>
    </div>

    {/* Expenses Breakdown Section */}
    <div className="pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Expenses</p>
        <div className="space-y-1 pl-2">
            {/* Regular Expenses */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1">
                    <FileText className="text-orange-400 w-3 h-3" />
                    Regular Expenses
                </span>
                <span className="text-sm font-semibold text-orange-600">
                    ₹<CountUp end={data.regular_expenses || 0} duration={1.5} decimals={2} separator="," />
                </span>
            </div>

            {/* Inventory Consumed */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1">
                    <Package className="text-red-400 w-3 h-3" />
                    Inventory Consumed
                </span>
                <span className="text-sm font-semibold text-red-600">
                    ₹<CountUp end={data.inventory_consumption || 0} duration={1.5} decimals={2} separator="," />
                </span>
            </div>

            {/* Capital Investment */}
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 flex items-center gap-1">
                    <ShoppingCart className="text-purple-400 w-3 h-3" />
                    Capital Investment
                </span>
                <span className="text-sm font-semibold text-purple-600">
                    ₹<CountUp end={data.capital_investment || 0} duration={1.5} decimals={2} separator="," />
                </span>
            </div>
        </div>
    </div>

    {/* Net Profit */}
    <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Net Profit</span>
            <span className={`text-lg font-bold ${(data.income - (data.operational_expenses || data.expenses || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹<CountUp end={(data.income || 0) - (data.operational_expenses || data.expenses || 0)} duration={1.5} decimals={2} separator="," />
            </span>
        </div>
    </div>
</div>
// ==================== END: REPLACE UNTIL HERE ====================

/**
 * WHAT THIS DOES:
 * 
 * Before (Single Line):
 * - Expenses: ₹9,210.20
 * 
 * After (Breakdown):
 * EXPENSES
 *   - Regular Expenses: ₹0.00
 *   - Inventory Consumed: ₹9,210.20
 *   - Capital Investment: ₹0.00
 * 
 * EXPECTED RESULT FOR RESTAURANT:
 * Assets: ₹0.00
 * Income: ₹540.00
 * EXPENSES
 *   Regular Expenses: ₹0.00
 *   Inventory Consumed: ₹9,210.20
 *   Capital Investment: ₹0.00
 * Net Profit: -₹8,670.20
 */
