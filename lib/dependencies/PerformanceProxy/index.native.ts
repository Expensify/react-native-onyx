import type performance from 'react-native-performance';
import {createModuleProxy, OptionalDependencyNotInstalledError} from '../ModuleProxy';

const PerformanceProxy = createModuleProxy<typeof performance>(() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('react-native-performance').default;
    } catch {
        throw new OptionalDependencyNotInstalledError('react-native-performance');
    }
});

export default PerformanceProxy;
