type ObjectArrayItemMock = {
    name: string;
    type: string;
    isEnabled: boolean;
    data: {value: number; label: string};
};

/** Creates an array of small objects (1 to 3 by default). "changedIndex" gives that item a different value. */
function createObjectArray(index: number, length = (index % 3) + 1, changedIndex?: number): ObjectArrayItemMock[] {
    return Array.from({length}, (_, itemIndex) => ({
        name: `item${itemIndex}`,
        type: 'item',
        isEnabled: true,
        data: {value: itemIndex === changedIndex ? 1 : 0, label: `label${index}`},
    }));
}

/** Creates "size" members keyed by "collectionKey" + index. */
function createObjectArrayCollection(collectionKey: string, size: number, createMember: (index: number) => ObjectArrayItemMock[] = createObjectArray): Record<string, ObjectArrayItemMock[]> {
    return Object.fromEntries(Array.from({length: size}, (_, index) => [`${collectionKey}${index}`, createMember(index)]));
}

export {createObjectArray, createObjectArrayCollection};
export type {ObjectArrayItemMock};
