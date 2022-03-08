import _ from 'underscore';

export default (arrayOfPromises) => {
    const wrappedPromises = _.map(arrayOfPromises, p => Promise.resolve(p)
        .then(
            val => ({status: 'fulfilled', value: val}),
            err => ({status: 'rejected', reason: err}),
        ));
    return Promise.all(wrappedPromises);
};
