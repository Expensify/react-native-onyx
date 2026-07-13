const alternateLists = (list1: unknown[], list2: unknown[]) =>
    list1.length > list2.length
        ? list1.flatMap((item, i) => [item, list2.at(i)]).filter((x) => x !== undefined)
        : list2.flatMap((item, i) => [list1.at(i), item]).filter((x) => x !== undefined);

export default alternateLists;
