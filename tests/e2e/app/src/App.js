import React from 'react';
import {Text, View} from 'react-native';
import PropTypes from 'prop-types';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import Main from './Main';
import ONYXKEYS from './keys';

const propTypes = {
    session: PropTypes.shape({login: PropTypes.string}),
};

const defaultProps = {
    session: {},
};

function App(props) {
    const isAuthenticated = Boolean(lodashGet(props.session, 'login', null));

    return (
        <View>
            {isAuthenticated && <Text aria-label="logged-in">You are logged in</Text>}
            <Main />
        </View>
    );
}

App.propTypes = propTypes;
App.defaultProps = defaultProps;
App.displayName = 'App';

export default withOnyx({
    session: {
        key: ONYXKEYS.SESSION,
    },
})(App);
