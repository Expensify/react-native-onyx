import React from 'react';
import PropTypes from 'prop-types';
// eslint-disable-next-line no-restricted-imports
import {View, Text} from 'react-native';

const propTypes = {
    text: PropTypes.string,
    onRender: PropTypes.func,
};

const defaultProps = {
    onRender: () => {},
    text: null,
};

function ViewWithText(props) {
    props.onRender();

    return (
        <View>
            <Text testID="text-element">{props.text || 'null'}</Text>
        </View>
    );
}

ViewWithText.propTypes = propTypes;
ViewWithText.defaultProps = defaultProps;
export default ViewWithText;
