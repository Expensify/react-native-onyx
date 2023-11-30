import React, {useImperativeHandle} from 'react';
import PropTypes from 'prop-types';
// eslint-disable-next-line no-restricted-imports
import {View, Text} from 'react-native';
import _ from 'underscore';

const propTypes = {
    collections: PropTypes.objectOf(
        PropTypes.shape({
            ID: PropTypes.number,
        }),
    ),
    testObject: PropTypes.shape({
        ID: PropTypes.number,
    }),
    onRender: PropTypes.func,
    markReadyForHydration: PropTypes.func,
};

const defaultProps = {
    collections: {},
    testObject: {isDefaultProp: true},
    onRender: () => {},
    markReadyForHydration: () => {},
};

const ViewWithCollections = React.forwardRef((props, ref) => {
    useImperativeHandle(ref, () => ({
        markReadyForHydration: props.markReadyForHydration,
    }));

    props.onRender(props);

    if (_.size(props.collections) === 0) {
        return <Text>empty</Text>;
    }

    return (
        <View>
            {_.map(props.collections, (collection, i) => (
                <Text key={i}>{collection.ID}</Text>
            ))}
        </View>
    );
});

ViewWithCollections.propTypes = propTypes;
ViewWithCollections.defaultProps = defaultProps;
export default ViewWithCollections;
