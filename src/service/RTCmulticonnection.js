import io from 'socket.io-client';

import { 
    logRTCMultiConnectionEvent as log, 
    logRTCMultiConnectionError as logErr,
    logRTCMultiConnectionSocketEvent as logSocket,
    logErrorEvent,
} from './log';

window.io = io; // RTCMultiConnection need to access the io class

var RTCMultiConnection; // the class
var connection; // the connection object for this client
var enableRecordings = false;
var videoRef;
var broadcastIdRef;
var allRecordedBlobs = [];
var componentEventHandlers = {};

export const initService = (callback = ()=>{}) => {
    RTCMultiConnection = window.RTCMultiConnection;
    if(!RTCMultiConnection) return log('RTCMultiConnection undefined');

    connection = new RTCMultiConnection();

    _setConnectionParams(connection);
    _setSocketConnection(connection);
    _setConnectionEventHandler(connection);

    log('Constructed connection object with default params set');
    log('Connection object: ', connection);

    callback(); // finish init callback
};

const _setConnectionParams = (connection) => {
    connection.enableScalableBroadcast = true;
    connection.maxRelayLimitPerUser = 1;
    connection.autoCloseEntireSession = true;
    connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
    connection.socketMessageEvent = 'wemon-msg-event';
};

const _setSocketConnection = (connection) => {
    connection.connectSocket((socket) => {
        if(!socket) return logErr('Cannot connect socket.');
        
        logSocket('Socket connected');

        let handlers = _socketHandlers(socket);

        socket.on('logs', handlers.logs);
        socket.on('join-broadcaster', handlers.joinBroadcaster);
        socket.on('rejoin-broadcast', handlers.rejoinBroadcast);
        socket.on('broadcast-stopped', handlers.broadcastStopped);
        socket.on('start-broadcasting', handlers.startBroadcasting);
    });
};

const _setConnectionEventHandler = (connection) => {
    let handlers = _connectionEventHandlers(connection);

    connection.onstream = handlers.onStream;
    connection.onstreamended = handlers.onStreamEnded;
    connection.onleave = handlers.onLeave;

    componentEventHandlers = _componentEventHandlers(connection);
};

export const setRefs = (refs) => {
    if(refs.broadcastIdRef) broadcastIdRef = refs.broadcastIdRef;
    if(refs.videoRef) videoRef = refs.videoRef;
};

export const getRefs = () => ({
    broadcastIdRef,
    videoRef
})

export const getComponentEventHandlers = ()=>( componentEventHandlers );

const _socketHandlers = (socket) => ({

    logs: (log) => {
        logSocket('logs: ', log);
    },

    joinBroadcaster: (hintsToJoinBroadcast) => {
        logSocket('join-broadcaster', hintsToJoinBroadcast);
        
        connection.session = hintsToJoinBroadcast.typeOfStreams;
        connection.sdpConstraints.mandatory = {
            OfferToReceiveVideo: !!connection.session.video,
            OfferToReceiveAudio: !!connection.session.audio
        };
        connection.broadcastId = hintsToJoinBroadcast.broadcastId;
        connection.join(hintsToJoinBroadcast.userid);
    },

    rejoinBroadcast: (broadcastId) => {
        logSocket('rejoin-broadcast', broadcastId);

        connection.attachStreams = [];
        socket.emit('check-broadcast-presence', broadcastId, function (isBroadcastExists) {
            if (!isBroadcastExists) {
                // the first person (i.e. real-broadcaster) MUST set his user-id
                connection.userid = broadcastId;
            }

            socket.emit('join-broadcast', {
                broadcastId: broadcastId,
                userid: connection.userid,
                typeOfStreams: connection.session
            });
        });
    },

    broadcastStopped: (broadcastId) => {
        logSocket('broadcast-stopped', broadcastId);
        alert('This broadcast has been stopped.');
    },

    startBroadcasting: (typeOfStreams) => {
        logSocket('start-broadcasting', typeOfStreams);
        
        // host i.e. sender should always use this!
        connection.sdpConstraints.mandatory = {
            OfferToReceiveVideo: false,
            OfferToReceiveAudio: false
        };
        connection.session = typeOfStreams;

        // "open" method here will capture media-stream
        // we can skip this function always; it is totally optional here.
        // we can use "connection.getUserMediaHandler" instead
        connection.open(connection.userid, function () {
            logSocket('room id: ' + connection.sessionid);
            // showRoomURL(connection.sessionid);
        });
    },

}); // end _socketHandlers

const _connectionEventHandlers = (connection) => ({

    onStream: (event) => {
        if (connection.isInitiator && event.type !== 'local') {
            return;
        };

        if(!videoRef) return logErr('onStream: No video Ref');

        connection.isUpperUserLeft = false;

        connection.isUpperUserLeft = false;
        videoRef.srcObject = event.stream;
        videoRef.play();

        videoRef.userid = event.userid;

        if (event.type === 'local') {
            videoRef.muted = true;
        }

        if (connection.isInitiator == false && event.type === 'remote') {
            // he is merely relaying the media
            connection.dontCaptureUserMedia = true;
            connection.attachStreams = [event.stream];
            connection.sdpConstraints.mandatory = {
                OfferToReceiveAudio: false,
                OfferToReceiveVideo: false
            };

            var socket = connection.getSocket();
            socket.emit('can-relay-broadcast');

            if (connection.DetectRTC.browser.name === 'Chrome') {
                connection.getAllParticipants().forEach(function (p) {
                    if (p + '' != event.userid + '') {
                        var peer = connection.peers[p].peer;
                        peer.getLocalStreams().forEach(function (localStream) {
                            peer.removeStream(localStream);
                        });
                        event.stream.getTracks().forEach(function (track) {
                            peer.addTrack(track, event.stream);
                        });
                        connection.dontAttachStream = true;
                        connection.renegotiate(p);
                        connection.dontAttachStream = false;
                    }
                });
            }

            if (connection.DetectRTC.browser.name === 'Firefox') {
                // Firefox is NOT supporting removeStream method
                // that's why using alternative hack.
                // NOTE: Firefox seems unable to replace-tracks of the remote-media-stream
                // need to ask all deeper nodes to rejoin
                connection.getAllParticipants().forEach(function (p) {
                    if (p + '' != event.userid + '') {
                        connection.replaceTrack(event.stream, p);
                    }
                });
            }

            // Firefox seems UN_ABLE to record remote MediaStream
            // WebAudio solution merely records audio
            // so recording is skipped for Firefox.
            if (connection.DetectRTC.browser.name === 'Chrome') {
                // repeatedlyRecordStream(event.stream);
            }
        };
    }, // end onStream

    onStreamEnded: ()=>{},

    onLeave: (event) => {
        if (event.userid !== videoRef.userid) return;
        
        let socket = connection.getSocket();
        socket.emit('can-not-relay-broadcast');

        connection.isUpperUserLeft = true;

        if(!videoRef) return logErr('onLeave: No video Ref');

        if (allRecordedBlobs.length) {
            // playing lats recorded blob
            var lastBlob = allRecordedBlobs[allRecordedBlobs.length - 1];
            videoRef.src = URL.createObjectURL(lastBlob);
            videoRef.play();
            allRecordedBlobs = [];
        } else if (connection.currentRecorder) {
            var recorder = connection.currentRecorder;
            connection.currentRecorder = null;
            recorder.stopRecording(function () {
                if (!connection.isUpperUserLeft) return;

                videoRef.src = URL.createObjectURL(recorder.getBlob());
                videoRef.play();
            });
        }

        if (connection.currentRecorder) {
            connection.currentRecorder.stopRecording();
            connection.currentRecorder = null;
        }
    }, // end onLeave
});

const _componentEventHandlers = (connection) => ({

    onOpenOrJoin: (broadcastId) => {
        if( !broadcastIdRef ) return logErr('onOpenOrJoin: no broadcastIdRef');

        if (broadcastId.replace(/^\s+|\s+$/g, '').length <= 0) {
            alert('Please enter broadcast-id');
            broadcastIdRef.focus();
            return;
        }

        connection.session = {
            audio: true,
            video: true,
            oneway: true
        };

        let socket = connection.getSocket();
        
        socket.emit('check-broadcast-presence', broadcastId, function (isBroadcastExists) {
            if (!isBroadcastExists) {
                // the first person (i.e. real-broadcaster) MUST set his user-id
                connection.userid = broadcastId;
            }

            log('check-broadcast-presence', broadcastId, isBroadcastExists);

            socket.emit('join-broadcast', {
                broadcastId: broadcastId,
                userid: connection.userid,
                typeOfStreams: connection.session
            });
        });
    },  

});

/* EXPORT */
export default {
    initService,  
    setRefs,
    getRefs,
    getComponentEventHandlers,
};