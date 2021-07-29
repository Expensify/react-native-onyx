/**
 * This is a higher order component that provides the ability to map a state property directly to
 * something in Onyx (a key/value store). That way, as soon as data in Onyx changes, the state will be set and the view
 * will automatically change to reflect the new data.
 */
import React from 'react';
import _ from 'underscore';
import PropTypes from 'prop-types';
import Str from 'expensify-common/lib/str';
import Onyx from './Onyx';

/**
 * Returns the display name of a component
 *
 * @param {object} component
 * @returns {string}
 */
function getDisplayName(component) {
    return component.displayName || component.name || 'Component';
}

export default function (mapOnyxToState) {
    return (WrappedComponent) => {
        class withOnyx extends React.Component {
            constructor(props) {
                super(props);

                // This stores all the Onyx connection IDs to be used when the component unmounts so everything can be
                // disconnected. It is a key value store with the format {[mapping.key]: connectionID}.
                this.activeConnectionIDs = {};

                this.state = {
                    loading: true,
                };
            }

            componentDidMount() {
                // Subscribe each of the state properties to the proper Onyx key
                Onyx.connectReactComponent(mapOnyxToState, this)
                    .then(({connectionIDs, state}) => {
                        this.activeConnectionIDs = {...this.activeConnectionIDs, ...connectionIDs};
                        this.setState({...state, loading: false});
                    });
                this.checkAndUpdateLoading();
            }

            componentDidUpdate(prevProps) {
                const modifiedConfig = {};

                // If any of the mappings use data from the props, then when the props change, all the
                // connections need to be reconnected with the new props
                _.each(mapOnyxToState, (mapping, propertyName) => {
                    const previousKey = Str.result(mapping.key, prevProps);
                    const newKey = Str.result(mapping.key, this.props);

                    if (previousKey !== newKey) {
                        Onyx.disconnect(this.activeConnectionIDs[previousKey], previousKey);
                        delete this.activeConnectionIDs[previousKey];
                        modifiedConfig[propertyName] = mapping;
                    }
                });
                Onyx.connectReactComponent(modifiedConfig, this);
                this.checkAndUpdateLoading();
            }

            componentWillUnmount() {
                // Disconnect everything from Onyx
                _.each(mapOnyxToState, (mapping) => {
                    const key = Str.result(mapping.key, this.props);
                    const connectionID = this.activeConnectionIDs[key];
                    Onyx.disconnect(connectionID, key);
                });
            }

            /**
             * Makes sure each Onyx key we requested has been set to state with a value of some kind.
             * We are doing this so that the wrapped component will only render when all the data
             * it needs is available to it.
             */
            checkAndUpdateLoading() {
                // We will add this key to our list of recently accessed keys
                // if the canEvict function returns true. This is necessary criteria
                // we MUST use to specify if a key can be removed or not.
                _.each(mapOnyxToState, (mapping) => {
                    if (_.isUndefined(mapping.canEvict)) {
                        return;
                    }

                    const canEvict = Str.result(mapping.canEvict, this.props);
                    const key = Str.result(mapping.key, this.props);

                    if (!Onyx.isSafeEvictionKey(key)) {
                        // eslint-disable-next-line max-len
                        throw new Error(`canEvict cannot be used on key '${key}'. This key must explicitly be flagged as safe for removal by adding it to Onyx.init({safeEvictionKeys: []}).`);
                    }

                    if (canEvict) {
                        Onyx.removeFromEvictionBlockList(key, mapping.connectionID);
                    } else {
                        Onyx.addToEvictionBlockList(key, mapping.connectionID);
                    }
                });
            }

            render() {
                if (this.state.loading) {
                    return null;
                }

                // Remove any internal state properties used by withOnyx
                // that should not be passed to a wrapped component
                let stateToPass = _.omit(this.state, 'loading');
                stateToPass = _.omit(stateToPass, value => _.isNull(value));

                // Remove any null values so that React replaces them with default props
                const propsToPass = _.omit(this.props, value => _.isNull(value));

                // Spreading props and state is necessary in an HOC where the data cannot be predicted
                return (
                    <WrappedComponent
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...propsToPass}
                        // eslint-disable-next-line react/jsx-props-no-spreading
                        {...stateToPass}
                        ref={this.props.forwardedRef}
                    />
                );
            }
        }

        withOnyx.propTypes = {
            forwardedRef: PropTypes.oneOfType([
                PropTypes.func,
                PropTypes.shape({current: PropTypes.instanceOf(React.Component)}),
            ]),
        };
        withOnyx.defaultProps = {
            forwardedRef: undefined,
        };
        withOnyx.displayName = `withOnyx(${getDisplayName(WrappedComponent)})`;
        return React.forwardRef((props, ref) => {
            const Component = withOnyx;
            // eslint-disable-next-line react/jsx-props-no-spreading
            return <Component {...props} forwardedRef={ref} />;
        });
    };
}
