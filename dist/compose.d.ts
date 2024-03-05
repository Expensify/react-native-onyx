/**
 * This is a utility function taken directly from Redux. (We don't want to add Redux as a dependency)
 * It enables functional composition, useful for the chaining/composition of HOCs.
 *
 * For example, instead of:
 *
 * export default hoc1(config1, hoc2(config2, hoc3(config3)))(Component);
 *
 * Use this instead:
 *
 * export default compose(
 *     hoc1(config1),
 *     hoc2(config2),
 *     hoc3(config3),
 * )(Component)
 *
 * @returns {Function}
 */
export default function compose(...funcs: any[]): Function;
