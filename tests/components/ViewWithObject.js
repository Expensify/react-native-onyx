import React from 'react';
import PropTypes from 'prop-types';
import {Text, View} from 'react-native';

const propTypes = {
    // eslint-disable-next-line react/no-unused-prop-types
    data: PropTypes.object,
};
const defaultProps = {
    data: {},
};

const ViewWithObject = (props) => {
    return (
        <View>
            <Text testID="text-element">{JSON.stringify(props)}</Text>
        </View>
    );
};

ViewWithObject.propTypes = propTypes;
ViewWithObject.defaultProps = defaultProps;
export default ViewWithObject;
