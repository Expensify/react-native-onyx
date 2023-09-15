import React from 'react';
// eslint-disable-next-line no-restricted-imports
import {Text, View} from 'react-native';
import PropTypes from 'prop-types';

const propTypes = {
    onRender: PropTypes.func,
};

const defaultProps = {
    onRender: () => {},
};

function ViewWithObject({onRender, ...props}) {
    onRender();

    return (
        <View>
            <Text testID="text-element">{JSON.stringify(props)}</Text>
        </View>
    );
}

ViewWithObject.propTypes = propTypes;
ViewWithObject.defaultProps = defaultProps;
export default ViewWithObject;
