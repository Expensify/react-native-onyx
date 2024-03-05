export default MDTable;
declare class MDTable {
    /**
     * Create a CSV string from the table data
     * @returns {string}
     */
    toCSV(): string;
    /**
     * Create a JSON string from the table data
     * @returns {string}
     */
    toJSON(): string;
    /**
     * Create a MD string from the table data
     * @returns {string}
     */
    toString(): string;
}
declare namespace MDTable {
    /**
     * Table Factory helper
     * @param {Object} options
     * @param {string} [options.title] - optional title center above the table
     * @param {string[]} options.heading - table column names
     * @param {number[]} [options.leftAlignedCols=[]] - indexes of columns that should be left aligned
     * Pass the columns that are non numeric here - the rest will be aligned to the right
     * @param {Array} [options.rows] The table can be initialized with row. Rows can also be added by `addRow`
     * @returns {MDTable}
     */
    function factory({ title, heading, leftAlignedCols, rows }: {
        title?: string | undefined;
        heading: string[];
        leftAlignedCols?: number[] | undefined;
        rows?: any[] | undefined;
    }): MDTable;
}
