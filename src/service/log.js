export const logBoldmessage = (message) => console.log(`%c ${message}`, 'font-weight: bold;');

export const logSocketEvent = (message) => console.log('%c SOCKET: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');
export const logSocketError = (message) => console.log('%c SOCKET: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');

export const logComponentEvent = (message) => console.log('%c COMPONENT: ' + `%c${message}`, 'font-weight: bold;', 'color: #42b3f4;');
export const logComponentError = (message) => console.log('%c COMPONENT: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');

export const logWebRTCEvent = (message) => console.log('%c WEBRTC: ' + `%c${message}`, 'font-weight: bold;', 'color: green;');

export const logRTCMultiConnectionEvent = function (message) {
    if(arguments.length !== 1) 
        return console.log('%c RTCMultiConnection: ', 'font-weight: bold;', ...arguments);
    if(typeof message !== 'string') 
        return console.log('%c RTCMultiConnection: ', 'font-weight: bold;', message);
    console.log('%c RTCMultiConnection: ' + `%c${message}`, 'font-weight: bold;', 'color: green;');
}
export const logRTCMultiConnectionError = (message) => console.log('%c RTCMultiConnection: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');

export const logDOMEvent = (message) => console.log('%c DOM: ' + `%c${message}`, 'font-weight: bold;', 'color: cyan;');
export const logDOMError = (message) => console.log('%c DOM: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');


export default {
    logBoldmessage,
    logSocketEvent,
    logComponentEvent,
    logWebRTCEvent,
    logRTCMultiConnectionEvent,
    logDOMEvent,
};