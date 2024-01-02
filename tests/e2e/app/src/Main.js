import React, {useEffect, useState} from 'react';
import {Button, StyleSheet, Text, View} from 'react-native';
import PropTypes from 'prop-types';
import lodashGet from 'lodash/get';
import _ from 'underscore';
import Onyx, {withOnyx} from 'react-native-onyx';
import ONYXKEYS from './keys';
import * as Updates from './lib/updates';
import * as Data from './data';

const propTypes = {
    session: PropTypes.shape({login: PropTypes.string}),
    // eslint-disable-next-line react/forbid-prop-types
    pokedex: PropTypes.shape({pokemon: PropTypes.arrayOf(PropTypes.object)}),
    randomNumber: PropTypes.shape({number: PropTypes.number}),
    allMeteorites: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.object)),
    allAsteroids: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.object)),
};

const defaultProps = {
    session: {},
    pokedex: {},
    randomNumber: {},
    allMeteorites: {},
    allAsteroids: {},
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        rowGap: 20,
        maxWidth: '100%',
    },
    containerButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        columnGap: 20,
    },
});

function Main(props) {
    const [isLeader, setIsLeader] = useState(Onyx.isClientTheLeader());

    const isAuthenticated = Boolean(lodashGet(props.session, 'login', null));

    useEffect(() => {
        if (!Onyx.subscribeToClientChange) {
            return;
        }

        Onyx.subscribeToClientChange(() => {
            setIsLeader(Onyx.isClientTheLeader());
        });
    }, []);

    const onLogIn = () => {
        Updates.clear();
        Onyx.merge(ONYXKEYS.SESSION, {login: 'test@test.com'});
        Onyx.merge(ONYXKEYS.RANDOM_NUMBER, {number: Date.now()});
    };

    const onLogOut = () => {
        Onyx.clear([]);
    };

    const onFetchPokedex = () => {
        Onyx.merge(ONYXKEYS.POKEDEX, Data.pokedex);
    };

    const onFetchSpaceData = (small) => {
        const date = Date.now();

        for (let i = 0; i <= (small ? 10 : 100); i++) {
            Onyx.merge(`${ONYXKEYS.COLLECTION.METEORITES}${date}${i}`, Data.meteorites);
            Onyx.merge(`${ONYXKEYS.COLLECTION.ASTEROIDS}${date}${i}`, Data.asteroids);
        }
    };

    return (
        <View style={styles.container}>
            {isAuthenticated ? (
                <View style={styles.container}>
                    <Text>{props.session.login}</Text>
                    <Button
                        title="Log Out"
                        onPress={onLogOut}
                    />
                    <View style={styles.containerButtons}>
                        <Button
                            title="Fetch Pokedex"
                            testID="fetch-pokedex-data"
                            onPress={onFetchPokedex}
                        />
                        <Button
                            title="Fetch Space data"
                            testID="fetch-space-data"
                            onPress={() => onFetchSpaceData(false)}
                        />
                        <Button
                            title="Fetch (small) Space data"
                            testID="fetch-small-space-data"
                            onPress={() => onFetchSpaceData(true)}
                        />
                    </View>
                </View>
            ) : (
                <Button
                    title="Log In"
                    onPress={onLogIn}
                />
            )}
            <Text aria-label="leader">{isLeader ? 'leader' : 'non-leader'}</Text>
            <Text aria-label="data-number">{lodashGet(props, 'randomNumber.number', undefined)}</Text>
            <Text aria-label="data-pokedex">{lodashGet(props, 'pokedex.pokemon.length', undefined)}</Text>
            <Text
                aria-label="data-meteorites"
                numberOfLines={10}
            >
                {_.filter(
                    _.map(Object.entries(props.allMeteorites || {}), ([key, value]) => (value ? `${key}-${value && value.length}` : undefined)),
                    (v) => !!v,
                ).join(',')}
            </Text>
            <Text
                aria-label="data-asteroids"
                numberOfLines={10}
            >
                {_.filter(
                    _.map(Object.entries(props.allAsteroids || {}), ([key, value]) => (value ? `${key}-${value && value.length}` : undefined)),
                    (v) => !!v,
                ).join(',')}
            </Text>
            <Text
                aria-label="data-updates"
                key={Updates.updates.length}
                numberOfLines={10}
            >
                {JSON.stringify(Updates.updates)}
            </Text>
            <Button
                title="Clear updates"
                onPress={Updates.clear}
            />
        </View>
    );
}

Main.propTypes = propTypes;
Main.defaultProps = defaultProps;
Main.displayName = 'Main';

export default withOnyx({
    session: {
        key: ONYXKEYS.SESSION,
    },
    pokedex: {
        key: ONYXKEYS.POKEDEX,
    },
    randomNumber: {
        key: ONYXKEYS.RANDOM_NUMBER,
    },
    allMeteorites: {
        key: ONYXKEYS.COLLECTION.METEORITES,
    },
    allAsteroids: {
        key: ONYXKEYS.COLLECTION.ASTEROIDS,
    },
})(Main);
