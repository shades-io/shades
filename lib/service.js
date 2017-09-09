/**
 * @version 0.1.0
 **/
'use strict';

const bunyan = require('bunyan');
const loader = require('shades-module-loader');

const { broker, store } = loader;

const plugins = [];
const projections = {};
const healthy = { store:false, broker:false };

/**
 * Event handler which is triggered when a change message is received in
 * the pipeline.
 *
 * @param {Object} message
 * @param {String} message.namespace scope model of the change
 * @param {String} message.projection_name name of the projection
 * @param {String} message.delta diff to be applied
 */
const onDataChanged = (message) => {
    const { namespace: ns, delta, projection_name: pname} = message;

    projections[ns] = projections[ns] || {};
    const projection = projections[ns][pname] || loader.projections[pname]();

    if (delta && projection.applyDelta) {
        projection.applyDelta(delta);
        projections[ns][pname] = projection;
        return Promise.resolve(projection);
    } else {
        return loadProjection(ns, pname);
    }
};

/**
 * Loads a single projection once a update message is received from the broker.
 *
 * @private
 * @param ns namespace
 * @param pname projection name
 * @return {Promise}
 */
const loadProjection = (ns, pname) => {
    return loader
        .store
        .projectionStates
        .get(ns, pname)
        .then(projection => {
            projections[ns] = projections[ns] || {};
            projections[ns][pname] = loader.projections[pname](projection);
            return projections[ns][pname];
        });

};

/**
 * Event handler. Reloads all projections from the latest projection available
 * on the broker at the time it connects to the store.
 *
 * @param log logger instance
 */
const reloadProjections = (log) => {
    return loader
        .store
        .projectionStates
        .all()
        .then(namespaces => {
            Object.keys(namespaces).forEach(ns => {
                projections[ns] = {};
                const projectionsMap = namespaces[ns];
                Object.keys(projectionsMap).forEach(pn => {
                    const projection = projectionsMap[pn];
                    projections[ns][pn] = loader.projections[pn](projection);
                });
            });
        });
};

/**
 * Event handler. Handles connection errors to the store and broker.
 *
 * @param {String} component component name (store or broker)
 * @param log logger instance
 */
const connectionError = (component, log) => {
    healthy[component] = false;
    log.error('%s connection error. Service is now unhealthy.', component);
};

/**
 * Adds plugins to the projections.
 *
 * @param name plugin name
 * @param generator plugin handler function
 */
const addPlugin = (name, generator) => {

    if(typeof generator !== 'function') {
        throw new Error('generator must be a function');
    }

    plugins.push({name, generator});
};

exports.status = () => healthy;

/**
 * Startup. Listens to store and broker events and subscribes the the
 * projection updates channel in the broker.
 */
exports.setup = (log) => {
    components.plugins.forEach((p) => addPlugin(p.name, p.generator));

    store.on('error', (err) => connectionError('store', log));
    broker.on('error', (err) => connectionError('broker', log));
    broker.on('connect', () => reloadProjections(log));
    store.on('connect', () => healthy.store = true);
    broker.on('connect', () => healthy.broker = true);

    return broker.updates.subscribe(onDataChanged);
};

exports.store = store;
exports.broker = broker;
exports.plugins = loader.plugins;
exports.projections = projections;
exports.updateProjection = onDataChanged;

 