/**
* entities
*/

'use strict';

const restify = require('restify');
const NotFound = restify.NotFoundError;
const Conflict = restify.ConflictError;
const BadRequest = restify.BadRequestError;

const Router = require('../utils/route.js');
const router = new Router();

const handlers = require('../utils/handlers.js');
const notifyAndRespond = handlers.notifyAndRespond;

/**
 *
 * @param projections
 */
const firstProjection = projections => {
    const keys = Object.keys(projections);
    return keys ? projections[keys[0]] : null;
};

/**
 *
 */
router.get('/:type/:id', (req, res, next) => {
    const id = req.params.id;
    const type = req.params.type;
    const namespace = req.params.namespace;
    const projection = firstProjection(req.projections[namespace] || {});

    if(!projection) { return next(new NotFound('namespace not found')); }

    const entities = projection.entities;

    if(!entities.exists(type, id)) {
        return next(new NotFound('entity not found'));
    }

    res.send({name: name, properties: entities.get(type, id)});
    return next();
});

/**
 *
 */
router.post('/', (req, res, next) => {
    const namespace = req.params.namespace;
    const projections = req.projections[namespace];
    const { id, type, data } = req.body || {};

    if (!projections) { next(new BadRequest('invalid namespace')); }

    //TODO: use ajv to validate JSON schema
    if(!id) { return next(new BadRequest('missing entity id')); }
    if(!type) { return next(new BadRequest('missing entity type')); }

    return req.broker.queue
        .enqueue({
            operation: 'create',
            namespace,
            entity: { id, type, data }
        }).then(() => {
            res.send(202);
            return next();
        }).catch(err => {
            return next(new ServiceUnavailable('could not contact the broker'));
        });
});

/**
 *
 */
router.put('/:type/:id', (req, res, next) => {
    const id = req.params.id;
    const type = req.params.type;
    const namespace = req.params.namespace;
    const projection = firstProjection(req.projections[namespace] || {});

    if (!projection) { return next(new NotFound('namespace not found')); }

    const entities = projection.entities;

    if(!entities.exists(type, id)) {
        return next(new NotFound('entity not found'));
    }

    //TODO: use ajv to validate body json schema

    return req.broker.queue
        .enqueue({
            operation: 'update',
            namespace,
            entity: { id, type, data: req.body }
        }).then(() => {
            res.send(202);
            return next();
        }).catch(err => {
            return next(new ServiceUnavailable('could not contact the broker'));
        });
});

/**
 *
 */
router.del('/:type/:id', (req, res, next) => {
    const id = req.params.id;
    const type = req.params.type;
    const namespace = req.params.namespace;
    const projection = firstProjection(req.projections[namespace] || {});

    if (!projection) { return next(new NotFound('namespace not found')); }

    const entities = projection.entities;

    if(!entities.exists(type, id)) {
        return next(new NotFound('entity not found'));
    }

    return req.broker.queue
        .enqueue({
            operation: 'delete',
            namespace,
            entity: { id, type }
        }).then(() => {
            res.send(202);
            return next();
        }).catch(err => {
            return next(new ServiceUnavailable('could not contact the broker'));
        });
});

exports.apply = (server) => {
    router.applyRoutes(server, '/:namespace/entities');
};
