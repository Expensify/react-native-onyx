/**
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */
import React from 'react';
import type { MapOnyxToState } from './types';
/**
 * @deprecated Use `useOnyx` instead of `withOnyx` whenever possible.
 *
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */
export default function <TComponentProps, TOnyxProps>(mapOnyxToState: MapOnyxToState<TComponentProps, TOnyxProps>, shouldDelayUpdates?: boolean): (component: React.ComponentType<TComponentProps>) => React.ComponentType<Omit<TComponentProps, keyof TOnyxProps>>;
