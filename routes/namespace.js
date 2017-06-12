/**
 * namespaces
 */

'use strict';

const restify = require('restify');
const snakeCase = require('snake-case');

const BadRequest = restify.BadRequestError;
const ServiceUnavailable = restify.ServiceUnavailableError;

const Router = require('../utils/route.js');
const router = new Router();

/**
 *
 */
const namespaces = operation => (req, res, next) => {
    const namespace = snakeCase(req.params.name);

    if (!namespace) { next(new BadRequest('invalid namespace')); }

    return req.broker.queue
        .enqueue({ operation, namespace })
        .then(() => {
            res.send(202);
            return next();
        }).catch(err => {
            return next(new ServiceUnavailable('could not contact the broker'));
        });
};

/**
 *
 */
router.get('/', (req, res, next) => {
    const namespaces = Object.keys(req.projections);
    res.send({ namespaces });
    return next();
});

/**
 *
 */
router.put('/:name', namespaces('create'));


/**
 *
 */
router.del('/:name', namespaces('delete'));

exports.apply = (server) => {
    router.applyRoutes(server, '/namespaces');
};
