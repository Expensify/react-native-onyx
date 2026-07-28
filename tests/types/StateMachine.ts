import StateMachine from '../../lib/StateMachine';

const transitions = {
    idle: ['loading'],
    loading: ['success', 'error'],
    success: [],
    error: ['idle'],
} as const;

const machine = new StateMachine('idle', transitions);

// Valid transitions
machine.transition('loading');
machine.transition('loading').transition('success');
machine.transition('loading').transition('error').transition('idle');

// @ts-expect-error illegal transition from idle
machine.transition('success');

// @ts-expect-error illegal transition from loading
machine.transition('loading').transition('idle');

// @ts-expect-error terminal state has no outgoing transitions
machine.transition('loading').transition('success').transition('loading');
