/**
 * Utility router for restify.
 **/
'use strict';

class Router {
    constructor() {
        this.routers = {};
    }

    route(path) {
        this.routers[path] = this.routers[path] || new RouteAdapter(path);
        return this.routers[path];
    }

    applyRoutes(server) {
        Object
            .keys(this.routers)
            .forEach((path) => this.routers[path].apply(server));
    }
}

class RouteAdapter {
    constructor(base) {
        this.base = base;
        this.routes = [];
    }

    builder(method, args) {
        if(!args || args.length < 1) { throw new Error('missing handler'); }

        const hasPath = (typeof args[0] === 'string');
        const handler = args[hasPath ? 1 : 0];
        const path = this.base + (hasPath ? args[0] : '');

        this.routes.push({method, path, handler});
        return this;
    }

    get() { return this.builder('get', [].slice.call(arguments)); }
    put() { return this.builder('put', [].slice.call(arguments)); }
    del() { return this.builder('del', [].slice.call(arguments)); }
    post() { return this.builder('post', [].slice.call(arguments)); }
    head() { return this.builder('head', [].slice.call(arguments)); }
    opts() { return this.builder('opts', [].slice.call(arguments)); }
    patch() { return this.builder('patch', [].slice.call(arguments)); }

    apply(server) {
        this.routes.forEach((route) => {
            server[route.method](route.path, route.handler);
        });
    }
}

module .exports = Router;
