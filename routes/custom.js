/**
 * Custom routes generated by plugins.
 **/

'use strict';

const restify = require('restify');
const NotFound = restify.NotFoundError;
const BadRequest = restify.BadRequestError;

const Router = require('restify-router').Router;
const router = new Router();

/**
 * Creates a custom route for a plugin using its name.
 *
 * @param pluginName plugin name
 * @returns {Function} restify route
 */
const middleware = (pluginName) => {
    return function custom(req, res, next) {
        const namespace = req.params.namespace;
        const projectionName = req.params.projection;
        const projection = req.projections[namespace][projectionName];

        if(!projection) {
            return next(new NotFound('projection not found'));
        }

        try {
            const result = projection.custom[pluginName](req.query);
            res.json(200, {projection: projectionName, namespace, result});
            return next();
        } catch (e) {
            return next(new BadRequest(e.message));
        }
    };
};

exports.apply = (server, plugins) => {
    if (!plugins) { return; }

    plugins.forEach((plugin) => {
        return router.get(`/${plugin.name}`, middleware(plugin.name))
    });

    router.applyRoutes(server, '/:namespace/:projection/custom');
};

