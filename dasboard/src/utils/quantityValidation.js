
/**
 * Normalizes a quantity value based on the unit type.
 * 
 * @param {string|number} value - The input value to normalize
 * @param {string} unit - The unit of measurement (optional)
 * @returns {number} - The normalized numeric value
 */
export const normalizeQuantity = (value, unit = "") => {
    if (value === "" || value === null || value === undefined) {
        return 0;
    }

    // Convert to number
    const numValue = parseFloat(value);

    // If conversion failed, return 0
    if (isNaN(numValue)) {
        return 0;
    }

    // Ensure non-negative
    if (numValue < 0) {
        return 0;
    }

    // Handle specific units that should be integers
    const integerUnits = ["pcs", "piece", "pieces", "unit", "units", "box", "boxes", "pkt", "packet", "packets", "nos", "numbers"];

    if (unit && integerUnits.includes(unit.toLowerCase())) {
        return Math.floor(numValue);
    }

    // Limit decimal places for other units (e.g., kg, ltr) to 3 decimal places
    // to avoid floating point precision issues
    return parseFloat(numValue.toFixed(3));
};

/**
 * Validates if a quantity is valid for a given unit
 * 
 * @param {number} value - The value to check
 * @param {string} unit - The unit
 * @returns {boolean} - True if valid
 */
export const isValidQuantity = (value, unit = "") => {
    if (typeof value !== 'number' || isNaN(value) || value < 0) {
        return false;
    }

    const integerUnits = ["pcs", "piece", "pieces", "unit", "units", "box", "boxes", "pkt", "packet", "packets", "nos", "numbers"];
    if (unit && integerUnits.includes(unit.toLowerCase())) {
        return Number.isInteger(value);
    }

    return true;
};
