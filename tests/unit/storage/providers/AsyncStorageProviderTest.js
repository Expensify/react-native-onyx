import AsyncStorageMock from '@react-native-async-storage/async-storage';
import _ from 'underscore';

import StorageProvider from '../../../../lib/storage/providers/AsyncStorage';

describe('storage/providers/AsyncStorage', () => {
    // Start each test with empty storage
    beforeEach(() => AsyncStorageMock.clear());

    const SAMPLE_ITEMS = [
        ['string', 'Plain String'],
        ['array', ['Mixed', {array: [{id: 1}, {id: 2}]}]],
        ['true', true],
        ['false', false],
        ['object', {id: 'Object', nested: {content: 'Nested object'}}],
        ['number', 100],
        ['null', null],
    ];

    describe('setItem', () => {
        it('Should stringify items to JSON string', () => {
            // Given sample content of all basic types
            const items = SAMPLE_ITEMS.slice();

            // Given expected string results
            const expectedCalls = [
                ['string', '"Plain String"'],
                ['array', '["Mixed",{"array":[{"id":1},{"id":2}]}]'],
                ['true', 'true'],
                ['false', 'false'],
                ['object', '{"id":"Object","nested":{"content":"Nested object"}}'],
                ['number', '100'],
                ['null', 'null'],
            ];

            // When sample items are saved
            _.each(items, args => StorageProvider.setItem(...args));

            // Then they should be parsed to string first
            _.each(expectedCalls, args => expect(AsyncStorageMock.setItem).toHaveBeenCalledWith(...args));
        });

        it('Setting item to null show clear existing value', () => StorageProvider.setItem('sample', 'Some content')
            .then(() => StorageProvider.setItem('sample', null))
            .then(() => StorageProvider.getItem('sample'))
            .then(value => expect(value).toBeNull()));
    });

    describe('getItem', () => {
        it('Should parse items read from storage as JSON strings', () => {
            // Given sample content of all basic types written to storage
            const callArgs = SAMPLE_ITEMS.slice();

            const writePromises = _.map(callArgs, args => StorageProvider.setItem(...args));

            // When stored values are read
            return Promise.all(writePromises)
                .then(() => {
                    // Then they should be parsed back to the original values
                    const promises = _.map(
                        callArgs,
                        ([key, parsedValue]) => StorageProvider
                            .getItem(key)
                            .then(value => expect(value).toEqual(parsedValue)),
                    );

                    return Promise.all(promises);
                });
        });
    });

    describe('multiSet', () => {
        it('Should stringify items to JSON string', () => {
            // Given sample content of all basic types
            const items = SAMPLE_ITEMS.slice();

            // Given expected string result
            const expectedCall = [
                ['string', '"Plain String"'],
                ['array', '["Mixed",{"array":[{"id":1},{"id":2}]}]'],
                ['true', 'true'],
                ['false', 'false'],
                ['object', '{"id":"Object","nested":{"content":"Nested object"}}'],
                ['number', '100'],
                ['null', 'null'],
            ];

            // When sample items are saved
            StorageProvider.multiSet(items);

            // Then they should be parsed to string first
            expect(AsyncStorageMock.multiSet).toHaveBeenCalledWith(expectedCall);
        });
    });

    describe('multiGet', () => {
        it('Should parse items read from storage as JSON strings', () => {
            // Given sample content of all basic types written to storage
            const items = SAMPLE_ITEMS.slice();
            const keys = _.map(items, _.head);

            return StorageProvider.multiSet(items)

                // When storage values are read
                .then(() => StorageProvider.multiGet(keys))

                // Then they should be parsed back to the original values
                .then(values => expect(values).toEqual(items));
        });
    });
});
