import React from 'react';
import PropTypes from 'prop-types';
// eslint-disable-next-line no-restricted-imports
import {View, Text} from 'react-native';

const propTypes = {
    text: PropTypes.string.isRequired,
    onRender: PropTypes.func,
};

const defaultProps = {
    onRender: () => {},
};

function ViewWithText(props) {
    props.onRender();

    return (
        <View>
            <Text testID="text-element">{props.text}</Text>
        </View>
    );
}

ViewWithText.propTypes = propTypes;
ViewWithText.defaultProps = defaultProps;
export default ViewWithText;
