import React, {forwardRef, useImperativeHandle} from 'react';
import {View, Text} from 'react-native';
import utils from '../../lib/utils';

type ViewWithCollectionsProps = {
    collections: Record<string, {ID: number}>;
    testObject: {isDefaultProp: boolean};
    onRender: (props: ViewWithCollectionsProps) => void;
    markReadyForHydration: () => void;
} & Record<string, unknown>;

function ViewWithCollections(
    {collections = {}, testObject = {isDefaultProp: true}, onRender, markReadyForHydration, ...rest}: ViewWithCollectionsProps,
    ref: React.Ref<{markReadyForHydration: () => void}>,
) {
    useImperativeHandle(ref, () => ({
        markReadyForHydration,
    }));

    console.log('{collections, testObject, onRender, markReadyForHydration, ...rest}', {collections, testObject, onRender, markReadyForHydration, ...rest});

    onRender?.({collections, testObject, onRender, markReadyForHydration, ...rest});
    if (utils.isEmptyObject(collections)) {
        return <Text>empty</Text>;
    }

    return (
        <View>
            {Object.values(collections).map((collection, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <Text key={i}>{collection.ID}</Text>
            ))}
        </View>
    );
}

export default forwardRef(ViewWithCollections);
export type {ViewWithCollectionsProps};
