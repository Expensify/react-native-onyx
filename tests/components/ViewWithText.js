import React from 'react';
import PropTypes from 'prop-types';
// eslint-disable-next-line no-restricted-imports
import {View, Text} from 'react-native';

const propTypes = {
    text: PropTypes.string.isRequired,
};

const ViewWithText = props => (
    <View>
        <Text testID="text-element">{props.text}</Text>
    </View>
);

ViewWithText.propTypes = propTypes;
export default ViewWithText;
