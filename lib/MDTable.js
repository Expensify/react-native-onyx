import AsciTable from 'ascii-table';

class MDTable extends AsciTable {
    static factory({
        title, heading, leftAligned = [], rows = []
    }) {
        const table = new MDTable({title, heading, rows});
        table.leftAligned = leftAligned;

        /* By default we want everything aligned to the right as most values are numbers
         * we just override the columns that are not right aligned */
        heading.forEach((name, idx) => table.setAlign(idx, AsciTable.RIGHT));
        leftAligned.forEach(idx => table.setAlign(idx, AsciTable.LEFT));

        return table;
    }

    toCSV() {
        return [this.getHeading(), ...this.getRows()].join('\n');
    }

    toJSON() {
        return JSON.stringify(super.toJSON());
    }

    toString() {
        // Ignore modifying the first |---| for titled tables
        let idx = this.getTitle() ? -2 : -1;
        const ascii = super.toString()
            .replace(/-\|/g, () => {
                /* we replace "----|" with "---:|" to align the data to the right in MD */
                idx++;

                if (idx < 0 || this.leftAligned.includes(idx)) {
                    return '-|';
                }

                return ':|';
            });

        // strip the top and the bottom row (----) to make an MD table
        const md = ascii.split('\n').slice(1, -1).join('\n');
        return md;
    }
}

export default MDTable;
