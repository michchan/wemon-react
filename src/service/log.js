export const logBoldmessage = (message) => console.log(`%c ${message}`, 'font-weight: bold;');

export const logSocketEvent = function (message) {
    if(arguments.length !== 1) 
        return console.log('%c Socket: ', 'font-weight: bold; color: rgb(107, 80, 16);', ...arguments);
    if(typeof message !== 'string') 
        return console.log('%c Socket: ', 'font-weight: bold; color: rgb(107, 80, 16);', message);
    console.log('%c Socket: ' + `%c${message}`, 'font-weight: bold; color: rgb(107, 80, 16);', 'color: rgb(107, 80, 16);');
}

export const logSocketError = (message) => console.log('%c SOCKET: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');

export const ComponentLogging = function(component) {
    this.component = component;

    this.log = function (message) {
        if(arguments.length !== 1) 
            return console.log(`%c ${this.component}: `, 'font-weight: bold; color: #42b3f4;', ...arguments);
        if(typeof message !== 'string') 
            return console.log(`%c ${this.component}: `, 'font-weight: bold; color: #42b3f4;', message);
        console.log(`%c ${this.component}: ` + `%c${message}`, 'font-weight: bold; color: #42b3f4;', 'color: #42b3f4;');
    };
};

export const logComponentError = (message) => console.log('%c COMPONENT: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');

export const logWebRTCEvent = (message) => console.log('%c WEBRTC: ' + `%c${message}`, 'font-weight: bold;', 'color: green;');

export const logRTCMultiConnectionEvent = function (message) {
    if(arguments.length !== 1) 
        return console.log('%c RTC: ', 'font-weight: bold; color: darkgreen;', ...arguments);
    if(typeof message !== 'string') 
        return console.log('%c RTC: ', 'font-weight: bold; color: darkgreen;', message);
    console.log('%c RTC: ' + `%c${message}`, 'font-weight: bold; color: darkgreen;', 'color: green;');
}

export const logRTCMultiConnectionSocketEvent = function (message) {
    if(arguments.length !== 1) 
        return console.log('%c RTC-socket: ', 'font-weight: bold; color: darkolivegreen;', ...arguments);
    if(typeof message !== 'string') 
        return console.log('%c RTC-socket: ', 'font-weight: bold; color: darkolivegreen;', message);
    console.log('%c RTC-socket: ' + `%c${message}`, 'font-weight: bold; color: darkolivegreen;', 'color: darkolivegreen;');
}

export const logErrorEvent = function (message) {
    if(arguments.length !== 1) 
        return console.log('%c Error: ', 'font-weight: bold; color: red;', ...arguments);
    if(typeof message !== 'string') 
        return console.log('%c Error: ', 'font-weight: bold; color: red;', message);
    console.log('%c Error: ' + `%c${message}`, 'font-weight: bold; color: red;', 'color: red;');
}

export const logRTCMultiConnectionError = (message) => console.log('%c RTC: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');

export const logDOMEvent = (message) => console.log('%c DOM: ' + `%c${message}`, 'font-weight: bold;', 'color: cyan;');
export const logDOMError = (message) => console.log('%c DOM: ' + `%c${message}`, 'font-weight: bold;', 'color: red;');


export default {
    logBoldmessage,
    logSocketEvent,
    ComponentLogging,
    logWebRTCEvent,
    logRTCMultiConnectionEvent,
    logDOMEvent,
};