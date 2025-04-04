import type {WithOnyxInstance} from '../../lib/withOnyx/types';

const generateEmptyWithOnyxInstance = () => {
    return new (class {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setStateProxy() {}

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        setWithOnyxState() {}
    })() as unknown as WithOnyxInstance;
};

export default generateEmptyWithOnyxInstance;
