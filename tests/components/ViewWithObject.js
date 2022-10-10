import React from 'react';
import {Text, View} from 'react-native';

const ViewWithObject = props => (
    <View>
        <Text testID="text-element">{JSON.stringify(props)}</Text>
    </View>
);

export default ViewWithObject;
