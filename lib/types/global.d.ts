type RowValue = string | number;

type ResultJSON = {
    title: string,
    heading: string[],
    rows: string[][]
};

type AsciiTableOptions = {
    title?: string;
    heading?: string[];
    leftAlignedCols?: number[];
    rows?: RowValue[][];
}

type MDTableOptions = {
    title?: string;
    heading?: string[];
    leftAlignedCols?: number[];
    rows?: RowValue[][];
}

declare module 'ascii-table' {
    export default class AsciiTable {
        constructor(options?: AsciiTableOptions);

        static LEFT: 0;
        static CENTER: 1;
        static RIGHT: 2;
        leftAlignedCols: number[];
        getTitle(): string;
        getHeading(): string[];
        addRow(...values: (RowValue[])): void;
        getRows(): string[][];
        setAlign(column: number, alignment: 0 | 1 | 2): void;
        toJSON(): ResultJSON | string;
        toString(): string;
    }
}
