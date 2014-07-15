/**
 * startup sim
 *
 * @copyright  Copyright (c) Tobias Zeising (http://www.aditu.de)
 * @license    GPLv3 (http://www.gnu.org/licenses/gpl-3.0.html)
 */
$(document).ready(function() {
    // initialize backend
    var backendHelpers = new BackendHelpers();
    var backendServer = new BackendServer();
    var backendClient = new BackendClient(backendHelpers);
    var backend = new Backend(backendHelpers, backendServer, backendClient);

    // initialize frontend
    var frontendEvents = new FrontendEvents();
    var frontendHelpers = new FrontendHelpers();
    var frontend = new Frontend(backend, backendHelpers, frontendEvents, frontendHelpers);
});
