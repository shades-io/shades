/**
 *
 **/
'use strict';

const restify = require('restify');
const NotFound = restify.NotFoundError;
const Conflict = restify.ConflictError;
const BadRequest = restify.BadRequestError;

const Router = require('../utils/route.js');
const router = new Router();
const route = router.route('/:projection/relationships');

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
route.get('/:aType/:aId/:bType/:bId', (req, res, next) => {
    const aId = req.params.aId;
    const aType = req.params.aType;
    const bId = req.params.bId;
    const bType = req.params.bType;
    const namespace = req.params.namespace;
    const projection = firstProjection(req.projections[namespace] || {});

    if(!projection) { return next(new NotFound('namespace not found')); }

    const relationships = projection.relationships;

    if(!relationships.exists(aType, aId, bType, bId)) {
        return next(new NotFound('relationship not found'));
    }

    const relationship = relationships.get(aType, aId, bType, bId);
    res.send(relationship);
    return next();
});

/**
 *
 */
route.post((req, res, next) => {
    const namespace = req.params.namespace;
    const projections = req.projections[namespace];
    const { entityA, entityB, data } = req.body || {};

    if (!projections) { next(new BadRequest('invalid namespace')); }

    //TODO: use ajv to validate JSON schema
    if(!entityA) { return next(new BadRequest('missing entity A')); }
    if(!entityB) { return next(new BadRequest('missing entity B')); }

    return req.broker.queue
        .enqueue({
            operation: 'create',
            namespace,
            relationship: { a: entityA, b: entityB, data }
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
route.put('/:fromType/:fromId/:toType/:toId', (req, res, next) => {
    const aId = req.params.aId;
    const aType = req.params.aType;
    const bId = req.params.bId;
    const bType = req.params.bType;
    const namespace = req.params.namespace;
    const projection = firstProjection(req.projections[namespace] || {});

    if(!projection) { return next(new NotFound('namespace not found')); }

    const relationships = projection.relationships;

    if(!relationships.exists(aType, aId, bType, bId)) {
        return next(new NotFound('relationship not found'));
    }

    return req.broker.queue
        .enqueue({
            operation: 'update',
            namespace,
            relationship: {
                a: { id: aId, type: aType },
                b: { id: bId, type: bType },
                data: req.body
            }
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
route.del('/:fromType/:fromId/:toType/:toId', (req, res, next) => {
    const aId = req.params.aId;
    const aType = req.params.aType;
    const bId = req.params.bId;
    const bType = req.params.bType;
    const namespace = req.params.namespace;
    const projection = firstProjection(req.projections[namespace] || {});

    if(!projection) { return next(new NotFound('namespace not found')); }

    const relationships = projection.relationships;

    if(!relationships.exists(aType, aId, bType, bId)) {
        return next(new NotFound('relationship not found'));
    }

    return req.broker.queue
        .enqueue({
            operation: 'delete',
            namespace,
            relationship: {
                a: { id: aId, type: aType },
                b: { id: bId, type: bType }
            }
        }).then(() => {
            res.send(202);
            return next();
        }).catch(err => {
            return next(new ServiceUnavailable('could not contact the broker'));
        });
});

exports.apply = (server) => {
    router.applyRoutes(server, '/:namespace/relationships');
};
