/**
* Shades API application
**/

'use strict';


const bunyan = require('bunyan');
const restify = require('restify');
const loader = require('shades-module-loader');

const entities = require('./routes/entities.js');
const relationships = require('./routes/relationships.js');
const custom = require('./routes/custom.js');

const service = require('./lib/service');

// variables
const config = loader.config.api || {};
const log = bunyan.createLogger(config.log || {name: 'shades'});
const port = process.env.PORT || 7123;
const projector = service.setup(log);

// server
const server = restify.createServer({ log: log });

// add standard plugins
server.use(restify.fullResponse());
server.use(restify.requestLogger());
server.use(restify.queryParser());
server.use(restify.bodyParser());

// logs all requests
if (config.audit) {
    server.on('after', restify.auditLogger({ log: log }));
}

server.get('/healthcheck', (req, res, next) => {
    const health = service.status();
    res.set('Content-Type', 'text/plain');

    if(health.pipeline && health.storage) {
        res.send(200, 'OK');
    } else {
        const unavailable = health.pipeline ? 'storage' : 'pipeline';
        res.set('Retry-After', 30);
        res.send(503, `${unavailable} is unavailable`);
    }

    res.end();
});

// make sure to make the components available to the routes
server.use(function components(req,res, next) {
    req.store = service.store;
    req.broker = service.broker;
    req.projections = service.projections;
    next();
});

// appends the routes to the server
entities.apply(server);
relationships.apply(server);
custom.apply(server, service.plugins);

server.listen(port, () => {
    log.info({url: server.url}, 'shades server started!');
});

process.on('uncaughtException', (err) => {
    const name = err && err.name ? err.name : 'UnknownError';
    // error logging
    log.error('Uncaught Exception:', err.stack);
    // force app re-start (if user remembered process monitoring...)
    process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
    log.warn('Unhandled Rejection at: Promise', p, 'reason:', reason);
});

const gracefulShutdown = () => {
    server.close(() => {
        log.info('Shutting down shades server');
        projector.unsubscribe();
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { server, lib };
