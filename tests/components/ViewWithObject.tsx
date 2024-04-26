import React from 'react';
import {Text, View} from 'react-native';

type ViewWithObjectProps = {
    onRender?: () => void;
} & Record<string, unknown>;

function ViewWithObject({onRender, ...rest}: ViewWithObjectProps) {
    onRender?.();

    return (
        <View>
            <Text testID="text-element">{JSON.stringify(rest)}</Text>
        </View>
    );
}

export default ViewWithObject;
