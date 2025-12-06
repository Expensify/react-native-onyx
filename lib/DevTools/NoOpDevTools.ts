import type {IDevTools} from './types';

/**
 * No-op implementation of DevTools that does nothing
 * Used when DevTools is disabled
 */
class NoOpDevTools implements IDevTools {
    registerAction(): void {
        // do nothing
    }

    initState(): void {
        // do nothing
    }

    clearState(): void {
        // do nothing
    }
}

export default NoOpDevTools;
