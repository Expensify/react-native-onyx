import React from 'react';
// eslint-disable-next-line no-restricted-imports
import {Text, View} from 'react-native';

const ViewWithObject = props => (
    <View>
        <Text testID="text-element">{JSON.stringify(props)}</Text>
    </View>
);

export default ViewWithObject;
