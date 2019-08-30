let _debug;

try {
    _debug = require('debug')('css-module-override-webpack-plugin');
}
catch(e) {
    // debug library not present
}

export default function debug(...args) {
    if(_debug) {
        _debug(...args);
    }
}