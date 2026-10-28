/**
 * One level of the argument cache. Object and function args are held weakly, so a cached result is
 * dropped as soon as the Onyx value it was computed from is replaced and garbage collected.
 */
class CacheNode {
    private objects?: WeakMap<object, CacheNode>;

    private primitives?: Map<unknown, CacheNode>;

    hasResult = false;

    result: unknown;

    getChild(arg: unknown): CacheNode {
        if ((typeof arg === 'object' && arg !== null) || typeof arg === 'function') {
            if (!this.objects) {
                this.objects = new WeakMap();
            }
            let child = this.objects.get(arg);
            if (!child) {
                child = new CacheNode();
                this.objects.set(arg, child);
            }
            return child;
        }

        if (!this.primitives) {
            this.primitives = new Map();
        }
        let child = this.primitives.get(arg);
        if (!child) {
            child = new CacheNode();
            this.primitives.set(arg, child);
        }
        return child;
    }
}

/**
 * Wraps a selector in a cache shared by every caller, keyed on the identity of each argument.
 *
 * `useOnyx` runs a selector separately in every hook instance. When many components select from the same
 * Onyx value, wrapping the selector at module level makes the first instance compute the result and the
 * rest reuse it, until the Onyx value (or any other argument) changes.
 *
 * Extra arguments are part of the cache key, so a selector that needs a value from the component takes it
 * as an argument instead of closing over it:
 *
 * ```ts
 * const accountIDByLogin = createOnyxSelector((personalDetails: OnyxEntry<PersonalDetailsList>, login: string) => ...);
 *
 * const [accountID] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {selector: (personalDetails) => accountIDByLogin(personalDetails, login)});
 * ```
 *
 * The combiner must be pure: it is only called again when an argument changes by reference.
 */
function createOnyxSelector<TArgs extends unknown[], TResult>(combiner: (...args: TArgs) => TResult): (...args: TArgs) => TResult {
    const root = new CacheNode();

    return (...args: TArgs): TResult => {
        let node = root;
        for (const arg of args) {
            node = node.getChild(arg);
        }

        if (node.hasResult) {
            return node.result as TResult;
        }

        const result = combiner(...args);
        node.hasResult = true;
        node.result = result;
        return result;
    };
}

export default createOnyxSelector;
