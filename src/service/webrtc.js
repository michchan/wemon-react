import LogService from './log';

export const Constants = {};

export const peerConnConfig = {
    'iceServers': [
        {
            'url': 'stun:stun.l.google.com:19302'
        }
    ]
};

export const getLocalStream = (updateSrcHandler = () => {}, rtcPeerConn) => {
    // get a local stream, show it in our video tag and add it to be sent
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    navigator.getUserMedia({
        'audio': true,
        'video': true
    }, function (stream) {

        LogService.logWebRTCEvent("Display Local Stream and add stream to RTCPeerConn");
        updateSrcHandler(stream);
        if (rtcPeerConn) 
            rtcPeerConn.addStream(stream);

        }
    , (err) => LogService.logWebRTCEvent(err));
}

export default {
    Constants,
    peerConnConfig,
    getLocalStream
};