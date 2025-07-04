import type {DeepRecord} from '../lib/types';

// The types declared inside this file should be used only for testing.

/**
 * Utility type to represent a object that can accept any value and contain any deep objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericDeepRecord = DeepRecord<string, any>;

// eslint-disable-next-line import/prefer-default-export
export type {GenericDeepRecord};
