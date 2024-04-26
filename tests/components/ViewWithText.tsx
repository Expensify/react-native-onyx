import React from 'react';
import {View, Text} from 'react-native';

type ViewWithTextProps = {
    text: string | null;
    onRender?: () => void;
};

function ViewWithText({onRender, text}: ViewWithTextProps) {
    onRender?.();

    return (
        <View>
            <Text testID="text-element">{text || 'null'}</Text>
        </View>
    );
}

export default ViewWithText;
