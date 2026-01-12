const alternateLists = (list1: unknown[], list2: unknown[]) =>
    list1.length > list2.length ? list1.flatMap((item, i) => [item, list2[i]]).filter((x) => x !== undefined) : list2.flatMap((item, i) => [list1[i], item]).filter((x) => x !== undefined);

export default alternateLists;
