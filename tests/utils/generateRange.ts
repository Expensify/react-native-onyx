function generateRange(start: number, end: number): number[] {
    return Array.from({length: end - start}, (_, i) => i + start);
}

export default generateRange;
