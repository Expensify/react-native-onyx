import {AppRegistry} from 'react-native';
import Onyx from 'react-native-onyx';

import App from './App';
import appConfig from './app.json';
import ONYXKEYS from './keys';

const config = {
    keys: ONYXKEYS,
};

Onyx.init(config);

AppRegistry.registerComponent(appConfig.name, () => App);
AppRegistry.runApplication(appConfig.name, {
    rootTag: document.getElementById('root'),
});
