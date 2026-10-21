"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleFlight = singleFlight;
/** Concurrent readers share one request; completion/failure allows a fresh request. */
function singleFlight(work) {
    let pending = null;
    return () => {
        if (!pending)
            pending = Promise.resolve().then(work).finally(() => { pending = null; });
        return pending;
    };
}
//# sourceMappingURL=single-flight.js.map