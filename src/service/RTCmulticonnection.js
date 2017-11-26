import io from 'socket.io-client';
import _ from 'lodash';

import { 
    logRTCMultiConnectionEvent as log, 
    logRTCMultiConnectionError as logErr,
    logRTCMultiConnectionSocketEvent as logSocket,
    logErrorEvent,
} from './log';

const RESOLUTIONS = [
    { name: 'QQVGA', width: 160, height: 120 },
    { name: 'QCIF', width: 176, height: 144 },
    { name: 'QVGA', width: 320, height: 240 },
    { name: 'CIF', width: 352, height: 288 },
    { name: '360p(nHD)', width: 640, height: 360, default: true },
    { name: 'VGA', width: 640, height: 480 },
    { name: 'SVGA', width: 800, height: 600 },
    { name: '720p(HD)', width: 1280, height: 720 },
];
const FRAME_RATES = [
    { name: 'Low', fps: 10, default: 'min' },
    { name: 'Normal', fps: 15, default: 'max' },
    { name: 'High', fps: 25 },
    { name: 'Very High', fps: 30 },
];

window.io = io; // RTCMultiConnection need to access the io class
var RTCMultiConnection = window.RTCMultiConnection; // the class

export default class RTCMultiConnectionSession {

    constructor(connectedSocketCallback=()=>{}, onStreamCallback=()=>{}, onSessionClosedCallback=()=>{}, onExtraDataUpdatedCallback=()=>{}, sessionId) {
        if(!RTCMultiConnection) return log('RTCMultiConnection undefined');

        // bind this for later usage
        this.connectedSocketCallback = connectedSocketCallback;
        this.onStreamCallback = onStreamCallback;
        this.onSessionClosedCallback = onSessionClosedCallback;
        this.onExtraDataUpdatedCallback = onExtraDataUpdatedCallback;
        this.sessionId = sessionId;

        if(sessionId) this.connection = new RTCMultiConnection(sessionId);
        else this.connection = new RTCMultiConnection();
        
        this.refs = {
            video: null,
            broadcastIdInput: null,            
        };

        this.buffer = {
            allRecordedBlobs: [],
        };

        this.enableRecordings = false;

        this.userEventHandlers = _getUserEventHandlers(this.connection, this.refs, this.buffer, onStreamCallback);
        
        _setConnectionParams(this.connection);
        _setConnectionConstraint(this.connection);
        _setSocketConnection(this.connection, connectedSocketCallback);
        _setConnectionEventHandler(this.connection, this.userEventHandlers, this.refs, this.buffer, onStreamCallback, onSessionClosedCallback, onExtraDataUpdatedCallback);
    
        log('Constructed connection object with default params set');
        log('Connection object: with session id: '+sessionId, this.connection);
    };

    setExtraDataUpdateHandler(handler) {
        _setConnectionEventHandler(this.connection, this.userEventHandlers, this.refs, this.buffer, this.onStreamCallback, this.onSessionClosedCallback, handler);
    }

} // class RTCMultiConnectionSession


// ==================== functions ======================

const _setConnectionParams = (connection) => {
    connection.enableScalableBroadcast = true;
    connection.maxRelayLimitPerUser = 1;
    connection.direction = "one-to-many";
    connection.autoCloseEntireSession = true;
    connection.socketURL = 'https://rtcmulticonnection.herokuapp.com:443/';
    connection.socketMessageEvent = 'wemon-msg-event';
    connection.beforeAddingStream = (stream, peer) => stream;
};

const _setConnectionConstraint = (connection) => {
    let defaultConstraints = {
        width: _getUserEventHandlers(connection).getDefaultResolution().width,
        height: _getUserEventHandlers(connection).getDefaultResolution().height,
        echoCancellation: false, // disabling audio processing
        // googAutoGainControl: true,
        // googNoiseSuppression: true,
        // googHighpassFilter: true,
        // googTypingNoiseDetection: true,
        minFrameRate: _getUserEventHandlers(connection).getDefaultMinFrameRate().fps,
        maxFrameRate: _getUserEventHandlers(connection).getDefaultMaxFrameRate().fps,
        aspectRatio: 1.2,
    };
    
    connection.mediaConstraints = filterConstraintsByBrowser(connection, defaultConstraints);
};

const _setSocketConnection = (connection, connectedSocketCallback) => {
    connection.connectSocket((socket) => {
        if(!socket) return logErr('Cannot connect socket.');
        
        logSocket('Socket connected',  socket);
        connectedSocketCallback(); // so that user can join or open

        let handlers = _socketHandlers(connection, socket);

        socket.on('logs', handlers.logs);
        socket.on('join-broadcaster', handlers.joinBroadcaster);
        socket.on('rejoin-broadcast', handlers.rejoinBroadcast);
        socket.on('broadcast-stopped', handlers.broadcastStopped);
        socket.on('start-broadcasting', handlers.startBroadcasting);
    });
};

const _setConnectionEventHandler = (connection, userEventHandlers, refs, buffer, onStreamCallback = ()=>{}, onSessionClosedCallback = ()=>{}, onExtraDataUpdatedCallback = ()=>{}) => {
    let handlers = _getConnectionEventHandlers(connection, refs, buffer, onStreamCallback, onSessionClosedCallback, onExtraDataUpdatedCallback);

    connection.onstream = handlers.onStream;
    connection.onstreamended = handlers.onStreamEnded;
    connection.onleave = handlers.onLeave;
    connection.onEntireSessionClosed = handlers.onEntireSessionClosed;
    connection.onExtraDataUpdated = handlers.onExtraDataUpdated;
    connection.onclose = handlers.onclose;
    connection.onleave = handlers.onleave;
};

const _socketHandlers = (connection, socket) => ({

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
        connection.connectionDescription = connection.join(hintsToJoinBroadcast.userid);
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
        connection.connectionDescription = connection.open(connection.userid, function () {
            logSocket('room id: ' + connection.sessionid);
            // showRoomURL(connection.sessionid);
        });
    },

}); // end _socketHandlers

const _getConnectionEventHandlers = (connection, refs, buffer, onStreamCallback, onSessionClosedCallback, onExtraDataUpdatedCallback) => ({

    onStream: (event) => {
        log(`######### ${connection.userid} onStream #########`, event, refs.video, event.stream);
        log(event);

        if (connection.isInitiator && event.type !== 'local') {
            return log('Broadcaster receives local stream');
        };

        if(!refs.video) logErr('onStream: No video Ref');

        connection.isUpperUserLeft = false;

        connection.isUpperUserLeft = false;

        /* Callback for setting video src */
        onStreamCallback(event, connection.mediaConstraints); // callback for setState src, set video srcObject or src here
        onExtraDataUpdatedCallback(event);

        if (connection.isInitiator == false && event.type === 'remote') {
            // he is merely relaying the media
            connection.dontCaptureUserMedia = true;
            connection.attachStreams = [event.stream];
            connection.sdpConstraints.mandatory = {
                OfferToReceiveAudio: false,
                OfferToReceiveVideo: false
            };

            let socket = connection.getSocket();
            socket.emit('can-relay-broadcast');

            if (connection.DetectRTC.browser.name === 'Chrome') {
                connection.getAllParticipants().forEach(function (p) {
                    if (p + '' != event.userid + '') {
                        let peer = connection.peers[p].peer;
                        peer.getLocalStreams().forEach(function (localStream) {
                            peer.removeStream(localStream);
                        });
                        log(event.stream);
                        log(peer);
                        event.stream.getTracks().forEach(function (track) {
                            if(typeof peer.addTrack === 'function') peer.addTrack(track, event.stream);
                            else logErr('peer.addTrack is not a function');
                            // else if(typeof peer.addStream === 'function') peer.addStream(event.stream);
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

    onStreamEnded: (e)=>{
        log(connection.userid + ' receive onStreamEnded ');
        // if(connection.userid !== e.userid) {
        //     log(connection.userid + ': received media stream ended: '+e.userid);
        //     onSessionClosedCallback(e, connection.userid);
        // }
    },

    onLeave: (event) => {
        if (event.userid !== refs.video.userid) return;
        
        let socket = connection.getSocket();
        socket.emit('can-not-relay-broadcast');

        connection.isUpperUserLeft = true;

        if(!refs.video) return logErr('onLeave: No video Ref');

        if (buffer.allRecordedBlobs.length) {
            // playing lats recorded blob
            let lastBlob = buffer.allRecordedBlobs[buffer.allRecordedBlobs.length - 1];
            refs.video.src = URL.createObjectURL(lastBlob);
            refs.video.play();
            buffer.allRecordedBlobs = [];
        } else if (connection.currentRecorder) {
            let recorder = connection.currentRecorder;
            connection.currentRecorder = null;
            recorder.stopRecording(function () {
                if (!connection.isUpperUserLeft) return;

                refs.video.src = URL.createObjectURL(recorder.getBlob());
                refs.video.play();
            });
        }

        if (connection.currentRecorder) {
            connection.currentRecorder.stopRecording();
            connection.currentRecorder = null;
        }
    }, // end onLeave

    onEntireSessionClosed: (e) => {
        if(connection.userid !== e.userid) {
            log(connection.userid + ': received entire session closed: '+e.userid);
            onSessionClosedCallback(e, connection.userid);
        }
    },

    onExtraDataUpdated: function(e) {
        // log(connection.userid + ' received extra data updated from: '+ e.userid, e.extra);
        onExtraDataUpdatedCallback(e);
    },

    onleave: (e) => {
        log(connection.userid + ' received leave from: '+e.userid);
    },

    onclose: (e) => {
        log(connection.userid + ' received Broadcaster closed the monitor: '+e.userid);
    },
});

const _getUserEventHandlers = (connection, refs, buffer, onStreamCallback) => ({

    openOrJoin: (broadcastId) => {
        log('openOrJoin broadcast');

        if (broadcastId.replace(/^\s+|\s+$/g, '').length <= 0) {
            alert('Please enter broadcast-id');
            if( refs.broadcastIdInput ) refs.broadcastIdInput.focus();
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
    
    leave: (remainConnected = false) => {
        if(connection.isInitiator) {
            closeConnection(connection);
            log('Closed session as initiator by' + connection.userid);
        } else {
            leaveConnection(connection);
            log('Left session as viewer: ' + connection.userid);
        };

        if(!remainConnected)
            connection = null;
    },

    applyConstraints: (constraints, errorCallback=()=>{}) => {
        let validConstraints = filterConstraintsByBrowser(connection, constraints);
        log('Apply Constraints, ', validConstraints, 'last Constraints, ', connection.mediaConstraints);

        if(connection.DetectRTC.browser.name === 'Chrome') {
            updateConstraintsInChrome(connection, validConstraints, onStreamCallback, errorCallback);
        } else {
            // for Firefox
            try {
                connection.applyConstraints(validConstraints);
            } catch (error) {
                logErr('Apply Constraints ERROR: ', error);
                errorCallback(error);
            }
        };
        
        if(connection.isInitiator) {
            connection.extra.constraints = { ...validConstraints };
            connection.updateExtraData();
        }
    },

    muteOrUnmuteStream: (mute = true, errorCallback=()=>{}) => {
        let streamEvent = connection.streamEvents.selectFirst();
        if(!streamEvent) return logErr('muteOrUnmuteStream: streamEvent undefined');

        try {
            log(mute? 'Mute stream ': 'Unmute stream', streamEvent);
            mute && streamEvent.stream.mute('both');
            !mute && streamEvent.stream.unmute('both');  
        } catch (error) {
            logErr('muteOrUnmuteStream ERROR: ', error);
            errorCallback(error);
        }
    },

    getResolutions: () => RESOLUTIONS.slice().reverse(),
    getDefaultResolution: () => _.find(RESOLUTIONS, { default: true }),

    getFrameRates: () => FRAME_RATES.slice(),
    getDefaultMaxFrameRate: () => _.find(FRAME_RATES, { default: 'max' }),
    getDefaultMinFrameRate: () => _.find(FRAME_RATES, { default: 'min' }),

    refreshConnection: (errorCallback=()=>{}) => {
        log('Refresh Connection');
        renegotiateConnection(connection, onStreamCallback, errorCallback);
    },

    rejoinConnection: (errorCallback=()=>{}) => {
        log('Rejoin Connection');
        renegotiateConnection(connection, onStreamCallback, errorCallback);
        connection.rejoin(connection.connectionDescription);
    },

});

const updateConstraintsInChrome = (connection, constraints, onStreamCallback, errorCallback) => {
    connection.getAllParticipants().forEach(function(uid) {
        var user = connection.peers[uid];
    
        user.peer.getLocalStreams().forEach(function(localStream) {
            user.peer.removeStream(localStream);
        });
    });
    
    connection.mediaConstraints = { ...connection.mediaConstraints, ...constraints }; // update constraints

    renegotiateConnection(connection, onStreamCallback, errorCallback);
};


const filterConstraintsByBrowser = (connection, constraints) => {
    const isChrome = connection.DetectRTC.browser.name === 'Chrome';
    const isFirefox = connection.DetectRTC.browser.name === 'Firefox';
    let filteredConstraints = isChrome? 
        { video: { mandatory: {}, optional: [] }, audio: { mandatory: {}, optional: [] } } : 
        { video: {}, audio: {} };
    let supports = navigator.mediaDevices.getSupportedConstraints();
    log('MediaConstraints support: ', supports);

    if( _.isObject(connection.mediaConstraints.video) ) {
        if(isFirefox) {
            filteredConstraints.video = { ...connection.mediaConstraints.video };
        } else {
            filteredConstraints.video.mandatory = { ...connection.mediaConstraints.video.mandatory };
            connection.mediaConstraints.video.optional.length > 0 
                && filteredConstraints.video.optional.push({ ...connection.mediaConstraints.video.optional[0] });
        }
    }
    if( _.isObject(connection.mediaConstraints.audio) ) {
        if(isFirefox) {
            filteredConstraints.audio = { ...connection.mediaConstraints.audio };
        } else {
            filteredConstraints.audio.mandatory = { ...connection.mediaConstraints.audio.mandatory };
            connection.mediaConstraints.audio.optional.length > 0 
                && filteredConstraints.audio.optional.push({ ...connection.mediaConstraints.audio.optional[0] });
        }
    }
    log('constraints before update: ', filteredConstraints);

    // if safari or opera etc.
    if(!isChrome && !isFirefox) return { video: true, audio: true };

    /* Video Constraints */
    if (supports.width && constraints.width) {
        if(isFirefox) filteredConstraints.video.width = constraints.width || connection.video.width;
        else {
            filteredConstraints.video.mandatory.minWidth = constraints.width;
            filteredConstraints.video.mandatory.maxWidth = constraints.width;
        };
    }
    if (supports.height && constraints.height) {
        if(isFirefox) filteredConstraints.video.height = constraints.height;
        else {
            filteredConstraints.video.mandatory.minHeight = constraints.height;
            filteredConstraints.video.mandatory.maxHeight = constraints.height;
        };
    }
    if(supports.aspectRatio && constraints.aspectRatio) {
        if(isFirefox) filteredConstraints.video.aspectRatio = constraints.aspectRatio;
        else filteredConstraints.video.mandatory.minAspectRatio = constraints.aspectRatio;
    }
    if(supports.frameRate && constraints.minFrameRate) {
        if(isFirefox) {
            !filteredConstraints.video.frameRate && (filteredConstraints.video.frameRate = {});
            filteredConstraints.video.frameRate.min = constraints.minFrameRate;
        } else {
            filteredConstraints.video.mandatory.minFrameRate = constraints.minFrameRate;
        };
    }
    if(supports.frameRate && constraints.maxFrameRate) {
        if(isFirefox) {
            !filteredConstraints.video.frameRate && (filteredConstraints.video.frameRate = {});
            filteredConstraints.video.frameRate.max = constraints.maxFrameRate;
        } else {
            filteredConstraints.video.mandatory.maxFrameRate = constraints.maxFrameRate;
        };
    }
    if(supports.deviceId && constraints.deviceId) {
        if(isFirefox) filteredConstraints.video.deviceId = constraints.deviceId;
        else {
            filteredConstraints.video.optional.length === 0 && filteredConstraints.video.optional.push({});
            filteredConstraints.video.optional[0].sourceId = constraints.deviceId;
        }
    }
    if(supports.facingMode && constraints.facingMode) {
        if(isFirefox) filteredConstraints.video.facingMode = constraints.facingMode;
        else {
            filteredConstraints.video.optional.length === 0 && filteredConstraints.video.optional.push({});
            filteredConstraints.video.optional[0].facingMode = constraints.facingMode;
        }
    }

    /* Audio Constraints */
    if(supports.echoCancellation && _.isBoolean(constraints.echoCancellation) ) {
        if(isFirefox) filteredConstraints.audio.echoCancellation = constraints.echoCancellation;
        else filteredConstraints.audio.mandatory.echoCancellation = constraints.echoCancellation;
    }

    if( _.isEmpty(filteredConstraints.video.mandatory) ) filteredConstraints.video = true;
    if( _.isEmpty(filteredConstraints.audio.mandatory) ) filteredConstraints.audio = true;

    log('Filtered Constraints by browser', filteredConstraints);
    return filteredConstraints;
};

const closeConnection = (connection) => {
    connection.extra.closed = true;
    connection.updateExtraData();
    connection.close() || connection.closeEntireSession();
    log('Closed session as initiator by' + connection.userid);
};

const leaveConnection = (connection) => {
    connection.extra.left = true;
    connection.updateExtraData();
    connection.leave();
    log('Left session as viewer: ' + connection.userid);
}

const renegotiateConnection = (connection, onStreamCallback, errorCallback) => {
    let oldStream = connection.attachStreams[0];
    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.getUserMedia || navigator.mozGetUserMedia;

    navigator.getUserMedia(connection.mediaConstraints, function(newStream) {
        
        try {
            connection.attachStreams = [newStream];
            
            log('New Local Stream: ', newStream);
            onStreamCallback({ stream: newStream, userid: connection.userid }, connection.mediaConstraints); // attach srcObject to video tag and play stream
    
            setTimeout(function() {
                oldStream.stop();
                // re-enable any button here
            }, 500);
    
            connection.getAllParticipants().forEach(function (pid) {
                if (`${pid}` != `${connection.userid}`) {
                    connection.dontAttachStream = true;
                    connection.renegotiate(pid);
                    connection.dontAttachStream = false;
                }
            });
        } catch(error) {
            logErr('Renegotiation ERROR: ', error);
            errorCallback(error);
        }

    }, function(error) {
        logErr('getUserMedia ERROR: ', error);
        errorCallback(error);
    });
}
