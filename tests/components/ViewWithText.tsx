import React from 'react';
import {View, Text} from 'react-native';

type ViewWithTextOnyxProps = {text: unknown};
type ViewWithTextProps = ViewWithTextOnyxProps & {
    // eslint-disable-next-line react/no-unused-prop-types -- it's used in withOnyx in the tests
    collectionID?: string;
    onRender?: () => void;
};

function ViewWithText({onRender, text}: ViewWithTextProps) {
    onRender?.();

    return (
        <View>
            <Text testID="text-element">{(text as string) || 'null'}</Text>
        </View>
    );
}

export default ViewWithText;
export type {ViewWithTextProps, ViewWithTextOnyxProps};
