import { logRTCMultiConnectionEvent as log, logRTCMultiConnectionError as logErr } from './log';

var RTCMultiConnection; // the class

// const connection = new RTCMultiConnection();

export const initService = () => {
    RTCMultiConnection = window.RTCMultiConnection;
    if(!RTCMultiConnection) return log('RTCMultiConnection undefined');

    const conn = new RTCMultiConnection();
    log('Constructed connection object');
    log('Connection object: ', conn);
};

export default {
    initService,  
};