/**


 @author: Hans van den Akker (mysim1)
 @license NPOSL-3.0
 @copyright Bizboard, 2015

 */

import extend                   from 'lodash/extend.js';
import EventEmitter             from 'eventemitter3';
import AnimationController      from 'famous-flex/AnimationController.js';

import {Dialog}                 from '../components/Dialog.js';
import {DialogManager}          from '../utils/DialogManager.js';
import {inject}                 from '../utils/di/Decorators.js';
import {ObjectHelper}           from '../utils/ObjectHelper.js';
import {Router}                 from './Router.js';


/**
 * The Controller class provides the highest level of control regarding the application features. Within the Controller context
 * each method will registered to receive calls from the Routing engine. With direct access to the Famo.us Context, every method can
 * control the creation of Views and Transitions.
 */
@inject(Router, AnimationController, DialogManager)
export class Controller extends EventEmitter {

    /**
     * Saves the router and context to this.router and this.context, respectively.
     * @param {Router} router Injected globally used router
     * @param {AnimationController} context Injected animationController used by the app
     * @param {DialogManager} dialogManager The dialog manager that shows and hides dialogs
     */
    constructor(router, context, dialogManager) {
        super();

        /**
         * The router used globally in the app
         * @type {Router}
         */
        this.router = router;
        /**
         * The AnimationController used globally in the app to change screens
         * @type {AnimationController}
         */
        this.context = context;
        /**
         * The dialogmanager used to show and hide dialogs. If a controller returns a Dialog, this will be used
         */
        this.dialogManager = dialogManager;

        /* The this._name property can be set by Arva's babel-plugin-transform-runtime-constructor-name plugin.
         * This allows Arva code to be minified and mangled without losing automated route creation.
         * If the plugin is not set up to run, which is done e.g. when not minifying your code, we default back to the runtime constructor name.*/
        let controllerName = this.constructor._name || Object.getPrototypeOf(this).constructor.name;

        ObjectHelper.bindAllMethods(this, this);

        /* Add the controller route to the router. */
        let routeName = controllerName.replace('Controller', '');
        routeName += '/:method';

        /* handle router url changes and execute the appropiate controller method. */
        this.router.add(routeName, {enter: this.onRouteCalled, leave: this.onLeave}, this);
    }

    /**
     * Called to notify the Controller that the route is changed
     * @param newRoute
     */
    onLeave(newRoute) {
        this.isActive = false;
    }

    /**
     * Called by the Router when this controller instance is being navigated to. Calls the controller's method in the given route,
     * and triggers a famous-flex AnimationController show() with the View instance that the method returns. Is also capable of receiving
     * a Promise from the method, in which case the show() is called after the promise is resolved.
     * @param {Object} route Route object generated by the Router. Contains a method name to call, and a render spec for passing to the AnimationController.
     * @returns {Boolean} success Whether the controller method was fully executed, and the Router should emit a routechange event.
     */
    onRouteCalled(route) {
        this.isActive = true;
        if (typeof this[route.method] === 'function') {
            let result = this[route.method].apply(this, route.values);

            if (result) {
                this.emit('renderstart', route.method);
                if (result instanceof Promise) { /* We can assume the method called was asynchronous from nature, therefore we await the result. */
                    result.then((delegatedresult) => {
                        this._showView(delegatedresult, route);
                    });
                } else {
                    this._showView(result, route);
                }
                return true;
            } else {
                console.log('Method did not return a View or a Promise instance.');
                return false;
            }
        } else {
            console.log('Route does not exist!');
            return false;
        }
    }

    /**
     * Shows a view that was returned from a child controller
     * @param {View} view
     * @param {Object} route
     * @private
     */
    _showView(view, route) {
        if(view instanceof Dialog){
            if(this.dialogManager.getOpenDialog() !== view){
                this.dialogManager.show({dialog: view, canCancel: false, shouldGoToRoute: this.router.getPreviousRoute()});
                this.dialogManager.once('dialogShown', () => {
                    this.emit('renderend', route.method);
                });
            } else {
                this.emit('renderend', route.method);
            }
        } else {
            /* Close if there's currently an open dialog */
            this.dialogManager.hasOpenDialog() && this.dialogManager._close();
            /* Assemble a callback based on the execution scope and have that called when rendering is completed. */
            this.context.show(view, route.spec, () => { this.emit('renderend', route.method); });
        }
        this.emit('rendering', route.method);
    }
}
