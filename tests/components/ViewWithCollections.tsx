// import React, {useImperativeHandle} from 'react';
// import PropTypes from 'prop-types';
// // eslint-disable-next-line no-restricted-imports
// import {View, Text} from 'react-native';
// import _ from 'underscore';

// const propTypes = {
//     collections: PropTypes.objectOf(
//         PropTypes.shape({
//             ID: PropTypes.number,
//         }),
//     ),
//     testObject: PropTypes.shape({
//         ID: PropTypes.number,
//     }),
//     onRender: PropTypes.func,
//     markReadyForHydration: PropTypes.func,
// };

// const defaultProps = {
//     collections: {},
//     testObject: {isDefaultProp: true},
//     onRender: () => {},
//     markReadyForHydration: () => {},
// };

// const ViewWithCollections = React.forwardRef((props, ref) => {
//     useImperativeHandle(ref, () => ({
//         markReadyForHydration: props.markReadyForHydration,
//     }));

//     props.onRender(props);

//     if (Object.keys(props.collections).length === 0) {
//         return <Text>empty</Text>;
//     }

//     return (
//         <View>
//             {Object.values(props.collections).map((collection, i) => (
//                 // eslint-disable-next-line react/no-array-index-key
//                 <Text key={i}>{collection.ID}</Text>
//             ))}
//         </View>
//     );
// });

// ViewWithCollections.propTypes = propTypes;
// ViewWithCollections.defaultProps = defaultProps;
// export default ViewWithCollections;

import React, {forwardRef, useImperativeHandle} from 'react';
import {View, Text} from 'react-native';

type ViewWithCollectionsProps = {
    collections: Record<string, {ID: number}>;
    testObject: {isDefaultProp: boolean};
    onRender: (props: ViewWithCollectionsProps) => void;
    markReadyForHydration: () => void;
} & Record<string, unknown>;

function ViewWithCollections(
    {collections = {}, testObject = {isDefaultProp: true}, onRender, markReadyForHydration, ...rest}: ViewWithCollectionsProps,
    ref: React.Ref<{markReadyForHydration: () => void}>,
) {
    useImperativeHandle(ref, () => ({
        markReadyForHydration,
    }));

    onRender?.({collections, testObject, onRender, markReadyForHydration, ...rest});

    if (Object.keys(collections).length === 0) {
        return <Text>empty</Text>;
    }

    return (
        <View>
            {Object.values(collections).map((collection, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <Text key={i}>{collection.ID}</Text>
            ))}
        </View>
    );
}

export default forwardRef(ViewWithCollections);
export type {ViewWithCollectionsProps};
