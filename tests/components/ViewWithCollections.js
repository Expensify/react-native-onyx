import React from 'react';
import PropTypes from 'prop-types';
import {View, Text} from 'react-native';
import _ from 'underscore';

const propTypes = {
    collections: PropTypes.objectOf(PropTypes.shape({
        ID: PropTypes.number,
    })),
    testObject: PropTypes.shape({
        ID: PropTypes.number,
    }),
    onRender: PropTypes.func,
};

const defaultProps = {
    collections: {},
    testObject: {isDefaultProp: true},
    onRender: () => {},
};

const ViewWithCollections = (props) => {
    props.onRender(props);

    return (
        <View>
            {_.map(props.collections, collection => (
                <Text>{collection.ID}</Text>
            ))}
        </View>
    );
};

ViewWithCollections.propTypes = propTypes;
ViewWithCollections.defaultProps = defaultProps;
export default ViewWithCollections;
