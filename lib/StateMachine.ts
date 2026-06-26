import type {ReadonlyDeep} from 'type-fest';

/**
 * A directed transition graph keyed by state name.
 * Use `as const` when defining a graph so illegal transitions are caught at compile time.
 *
 * @example
 * const transitions = {
 *     idle: ['loading'],
 *     loading: ['success', 'error'],
 *     success: [],
 *     error: ['idle'],
 * } as const;
 */
type TransitionGraph = Readonly<Record<string, readonly string[]>>;

/** Target states reachable from `Current` according to `Graph`. */
type TransitionsFrom<Graph extends TransitionGraph, Current extends keyof Graph & string> = Graph[Current] extends ReadonlyArray<infer Target extends string> ? Target : never;

/**
 * An immutable, type-safe finite state machine.
 * Pass the transition graph with `as const` so `transition` only accepts legal target states.
 *
 * @example
 * const transitions = {
 *     idle: ['loading'],
 *     loading: ['success', 'error'],
 *     success: [],
 *     error: ['idle'],
 * } as const;
 *
 * const idleMachine = new StateMachine('idle', transitions);
 * const loadingMachine = idleMachine.transition('loading');
 * loadingMachine.transition('success');
 */
class StateMachine<const Graph extends TransitionGraph, Current extends keyof Graph & string> {
    /** The current state. Deeply readonly and owned by this state machine instance. */
    readonly state: ReadonlyDeep<Current>;

    private readonly transitions: Graph;

    constructor(currentState: Current, transitions: Graph) {
        this.state = currentState as ReadonlyDeep<Current>;
        this.transitions = transitions;
        Object.freeze(this);
    }

    /**
     * Transition to a new state, returning a new state machine instance.
     * Only transitions declared in the graph for the current state are accepted.
     */
    transition<Target extends TransitionsFrom<Graph, Current>>(target: Target): StateMachine<Graph, Target> {
        const validTargets = this.transitions[this.state as Current];
        if (!validTargets?.includes(target)) {
            throw new Error(`Illegal transition from "${String(this.state)}" to "${String(target)}"`);
        }

        return new StateMachine(target, this.transitions);
    }
}

export default StateMachine;
export type {TransitionGraph, TransitionsFrom};
