import io from 'socket.io-client';
import _ from 'lodash';

import { 
    logRTCMultiConnectionEvent as log, 
    logRTCMultiConnectionError,
    logRTCMultiConnectionSocketEvent as logSocket,
    logErrorEvent as logErr,
} from './log';
import { setTimeout } from 'core-js/library/web/timers';

const RESOLUTIONS = [
    { name: 'QQVGA', width: 160, height: 120 },
    { name: 'QCIF', width: 176, height: 144 },
    { name: 'QVGA', width: 320, height: 240 },
    { name: 'CIF', width: 352, height: 288 },
    { name: '360p(nHD)', width: 640, height: 360 },
    { name: 'VGA', width: 640, height: 480, default: true },
    { name: 'SVGA', width: 800, height: 600 },
    { name: '720p(HD)', width: 1280, height: 720 },
]; 
const FRAME_RATES = [
    { name: 'Flickering', fps: 5 },
    { name: 'Poor', fps: 10, default: 'min' },
    { name: 'Very Low', fps: 15 },
    { name: 'Low', fps: 20, default: 'max' },
    { name: 'Acceptable', fps: 25 },
    { name: 'Normal', fps: 30 },
    { name: 'Very High', fps: 45 },
    { name: 'Excellent', fps: 60 },
];

window.io = io; // RTCMultiConnection need to access the io class
var RTCMultiConnection = window.RTCMultiConnection; // the class

export default class RTCMultiConnectionSession {

    constructor(connectedSocketCallback=()=>{}, onStreamCallback=()=>{}, onSessionClosedCallback=()=>{}, onMuteOrUnmuteCallback=()=>{}, captureUserMediaErrorCallback=()=>{}, onExtraDataUpdatedCallback=()=>{}, sessionId) {
        if(!RTCMultiConnection) return log('RTCMultiConnection undefined');

        if(sessionId) this.connection = new RTCMultiConnection(sessionId);
        else this.connection = new RTCMultiConnection();

        // bind this for later usage
        this.connectedSocketCallback = connectedSocketCallback;
        this.onStreamCallback = onStreamCallback;
        this.onSessionClosedCallback = onSessionClosedCallback;
        this.onExtraDataUpdatedCallback = onExtraDataUpdatedCallback;
        this.sessionId = sessionId;
        this.onMuteOrUnmuteCallback = onMuteOrUnmuteCallback;
        this.captureUserMediaErrorCallback = captureUserMediaErrorCallback;
        
        this.recorder = null;
        
        this.refs = {
            video: null,
            broadcastIdInput: null,            
        };

        this.buffer = {
            recordings: [],
        };

        this.enableRecordings = false;

        this.userEventHandlers = _getUserEventHandlers(this.connection, this.refs, this.buffer, onStreamCallback);
        
        _setConnectionParams(this.connection);
        this.connection.mediaConstraints = _getDefaultConnectionConstraint(this.connection);
        _setSocketConnection(this.connection, connectedSocketCallback);
        _setConnectionEventHandler(this.connection, this.userEventHandlers, this.refs, this.buffer, onStreamCallback, onSessionClosedCallback, onExtraDataUpdatedCallback, onMuteOrUnmuteCallback, captureUserMediaErrorCallback);
    
        log('Constructed connection object with default params set');
        log('Connection object: with session id: '+sessionId, this.connection);
    };

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
    connection.extra.muted = { video: false, audio: false };
    connection.enableLogs = true;
};

const _getDefaultConnectionConstraint = (connection) => {
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
    
    return filterConstraintsByBrowser(connection, defaultConstraints);
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

const _setConnectionEventHandler = (connection, userEventHandlers, refs, buffer, onStreamCallback = ()=>{}, onSessionClosedCallback = ()=>{}, onExtraDataUpdatedCallback = ()=>{}
, onMuteOrUnmuteCallback=()=>{}, captureUserMediaErrorCallback) => {
    let handlers = _getConnectionEventHandlers(connection, refs, buffer, onStreamCallback, onSessionClosedCallback, onExtraDataUpdatedCallback, onMuteOrUnmuteCallback);

    connection.captureUserMediaErrorCallback = captureUserMediaErrorCallback || ((e, constraints)=>logErr('captureUserMedia error', e, constraints));
    connection.onstream = handlers.onStream;
    connection.onstreamended = handlers.onStreamEnded;
    connection.onEntireSessionClosed = handlers.onEntireSessionClosed;
    connection.onExtraDataUpdated = handlers.onExtraDataUpdated;
    connection.onmute = handlers.onMute;
    connection.onunmute = handlers.onUnmute;
    connection.onclose = handlers.onClose;
    // connection.onleave = handlers.onLeave;
    connection.onMediaError = handlers.onMediaError;
    connection.onmessage = handlers.onMessage;
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

/* Connection event handlers */
const _getConnectionEventHandlers = (connection, refs, buffer, onStreamCallback, onSessionClosedCallback, onExtraDataUpdatedCallback, onMuteOrUnmuteCallback) => ({

    onStream: (event) => {
        log(`######### ${connection.userid} onStream ${event.stream.id} #########`);
        log('event: ', event, 'refs: ', refs.video, 'stream', event.stream);

        if (connection.isInitiator && event.type !== 'local') { // broadcast && remote
            log(`  ######### Broadcaster receives remote stream.`);
            return log('Broadcaster receives remote stream');
        };
        // if(!refs.video) logErr('onStream: No video Ref');

        connection.isUpperUserLeft = false;
        connection.latestStreamId = event.stream.id;
        
        /* Callback for setting video src */
        onStreamCallback(event, connection.mediaConstraints); // callback for setState src, set video srcObject or src here
        _handleExtraDataUpdate(connection, event, onExtraDataUpdatedCallback, onMuteOrUnmuteCallback);
        

        if (connection.isInitiator == false && event.type === 'remote') { //viewer && remote
            log(`  ######### Viewer receives remote stream.`);
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
                        log('Peer to relay to: ', peer, ' stream: ', event.stream);
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
        _handleExtraDataUpdate(connection, e, onExtraDataUpdatedCallback, onMuteOrUnmuteCallback);
    },

    /* Deprecated */
    onMute: function(e) { 
        if( connection.lastMuteType === e.muteType ) return;

        log(connection.userid + ' received onMute event: ');
        log(e);
        if(!connection.isInitiator) return onMuteOrUnmuteCallback('mute', e); //e.muteType

        if(!connection.extra.muted[e.muteType]){
            connection.extra.muted[e.muteType] = true;
            connection.updateExtraData();
        }

        connection.lastMuteType = e.muteType;
    },

    /* Deprecated */
    onUnmute: function(e) {
        if( connection.lastUnmuteType === e.unmuteType ) return;

        log(connection.userid + ' received onUnmute event: ');
        log(e);
        if(!connection.isInitiator) return onMuteOrUnmuteCallback('unmute', e); //e.unmuteType

        if(!!connection.extra.muted[e.unmuteType]){
            connection.extra.muted[e.unmuteType] = false;
            connection.updateExtraData();
        }

        connection.lastUnmuteType = e.unmuteType;
    },

    onClose: (e) => {
        log(connection.userid + ' received Broadcaster closed the monitor: '+e.userid);
    },

    onMediaError: (err, constraints) => {
        logErr('onMediaError: ', err, 'Constraints: ', constraints);
        connection.captureUserMediaErrorCallback(err, constraints);
    },
    
    onMessage: (message) => {
        log(connection.userid +' received custom message: ', message);
    },

});


/* User Event Handlers */
const _getUserEventHandlers = (connection, refs, buffer, onStreamCallback) => ({

    openOrJoin: (broadcastId) => {
        log(connection.userid + ' openOrJoin broadcast');

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

    applyConstraints: (constraints, errorCallback=()=>{}, filtered = false) => {
        let validConstraints = filtered? constraints : filterConstraintsByBrowser(connection, constraints);

        if( _.isEqual(validConstraints, connection.mediaConstraints) ) 
            return log('Same constraints found, not proceeding to update.');
        log(connection.userid + ' Apply Constraints, ', validConstraints, 'last Constraints, ', connection.mediaConstraints);

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

    muteOrUnmuteStream: (mute = true, type = 'audio', errorCallback=()=>{}, srcObject) => {
        try {
            log('muteOrUnmuteStream by '+connection.userid+' type: '+type+' mute? '+mute);
            
            _.forEach(connection.streamEvents, (props) => {
                if(typeof props !== 'object') return;

                let event = props;
                log('each stream event ', event);                

                if(!!mute ) {                    
                    // if(!connection.extra.muted[type]){
                        event.stream.mute(type);                        
                        connection.extra.muted[type] = true;
                        connection.extra.action = { type: 'mute', payload: { muteType: type } };
                    // }
                } else { // unmute                    
                    // if( !!connection.extra.muted[type]){
                        event.stream.unmute(type);  
                        connection.extra.muted[type] = false;
                        connection.extra.action = { type: 'unmute', payload: { unmuteType: type } };
                    // }
                }
                connection.updateExtraData();                
                
            });
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
        connection.rejoin(connection.connectionDescription);
    },

    getDefaultConstraints: () => _getDefaultConnectionConstraint(connection),

});

const updateConstraintsInChrome = (connection, constraints, onStreamCallback, errorCallback) => {
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

    // Merge empty constraints with existing connection.mediaConstraints
    if( _.isObject(connection.mediaConstraints.video) ) {
        if(isFirefox) {
            filteredConstraints.video = { ...connection.mediaConstraints.video };
        } else if(isChrome) {
            filteredConstraints.video.mandatory = { ...connection.mediaConstraints.video.mandatory };
            connection.mediaConstraints.video.optional.length > 0 
                && filteredConstraints.video.optional.push({ ...connection.mediaConstraints.video.optional[0] });
        }
    }
    if( _.isObject(connection.mediaConstraints.audio) ) {
        if(isFirefox) {
            filteredConstraints.audio = { ...connection.mediaConstraints.audio };
        } else if(isChrome) {
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
        else if(isChrome) {
            filteredConstraints.video.mandatory.minWidth = constraints.width;
            filteredConstraints.video.mandatory.maxWidth = constraints.width;
        };
    }
    if (supports.height && constraints.height) {
        if(isFirefox) filteredConstraints.video.height = constraints.height;
        else if(isChrome) {
            filteredConstraints.video.mandatory.minHeight = constraints.height;
            filteredConstraints.video.mandatory.maxHeight = constraints.height;
        };
    }
    if(supports.aspectRatio && constraints.aspectRatio) {
        if(isFirefox) filteredConstraints.video.aspectRatio = constraints.aspectRatio;
        else if(isChrome) filteredConstraints.video.mandatory.minAspectRatio = constraints.aspectRatio;
    }
    if(supports.frameRate && constraints.minFrameRate) {
        if(isFirefox) {
            !filteredConstraints.video.frameRate && (filteredConstraints.video.frameRate = {});
            filteredConstraints.video.frameRate.min = constraints.minFrameRate;
        } else if(isChrome) {
            filteredConstraints.video.mandatory.minFrameRate = constraints.minFrameRate;
        };
    }
    if(supports.frameRate && constraints.maxFrameRate) {
        if(isFirefox) {
            !filteredConstraints.video.frameRate && (filteredConstraints.video.frameRate = {});
            filteredConstraints.video.frameRate.max = constraints.maxFrameRate;
        } else if(isChrome) {
            filteredConstraints.video.mandatory.maxFrameRate = constraints.maxFrameRate;
        };
    }
    if(supports.deviceId && constraints.deviceId) {
        if(isFirefox) filteredConstraints.video.deviceId = constraints.deviceId;
        else if(isChrome) {
            filteredConstraints.video.optional.length === 0 && filteredConstraints.video.optional.push({});
            filteredConstraints.video.optional[0].sourceId = constraints.deviceId;
        }
    }
    if(supports.facingMode && constraints.facingMode) {
        if(isFirefox) filteredConstraints.video.facingMode = constraints.facingMode;
        else if(isChrome) {
            filteredConstraints.video.optional.length === 0 && filteredConstraints.video.optional.push({});
            filteredConstraints.video.optional[0].facingMode = constraints.facingMode;
        }
    }

    /* Audio Constraints */
    if(supports.echoCancellation && _.isBoolean(constraints.echoCancellation) ) {
        if(isFirefox) filteredConstraints.audio.echoCancellation = constraints.echoCancellation;
        else if(isChrome) filteredConstraints.audio.mandatory.echoCancellation = constraints.echoCancellation;
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
    connection.captureUserMediaErrorCallback = errorCallback; // bind user event error callback to onMediaError

    if(connection.attachStreams.length !==0 ) {
        connection.attachStreams.forEach((oldStream) => {
            setTimeout(()=>{
                oldStream.stop();                
            }, 3000);
        });
    };

    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

    connection.captureUserMedia(function(newStream){
        try {
            connection.attachStreams = [newStream];

            var video = document.createElement('video');
            video.src = URL.createObjectURL(newStream);
            video.muted = true;
            
            let streamEvent = {
                type: 'local',
                stream: newStream,
                streamid: newStream.id,
                userid: connection.userid,
                mediaElement: video // media element is not needed for our onstream event in our case.
            };
            connection.latestStreamId = newStream.id; // for muting use

            log('New Local stream event from connection.captureUserMedia: ', streamEvent);   
            log('streamEvents before new stream: ', connection.streamEvents);
            connection.onstream(streamEvent);
            connection.streamEvents = _getEmptyStreamEvents(connection);
            connection.streamEvents[streamEvent.id] = streamEvent;
            
            connection.getAllParticipants().forEach(function (pid) {
                if (`${pid}` != `${connection.userid}`) {
                    log('RENEGOTIATE with '+pid);
                    connection.dontAttachStream = true;
                    connection.renegotiate(pid);
                    connection.dontAttachStream = false;
                }
            });

        } catch(error) {
            logErr('Renegotiation ERROR: ', error);
            errorCallback(error);
        }
    }, connection.mediaConstraints);
}

const _getEmptyStreamEvents = (connection) => {
    let newStreamEvents = {};
    _.forEach(connection.streamEvent, (props, key) => {
        if(typeof props === 'object') return;
        newStreamEvents[key] = props;
    });
    return newStreamEvents;
};

const _handleExtraDataUpdate = (connection, e, onExtraDataUpdatedCallback, onMuteOrUnmuteCallback) => {
    if( !e.extra ) return;

    log(connection.userid + ' received extra data updated from: '+ e.userid, e.extra);
    
    // if( e.extra.action ) {
    //     let action = e.extra.action;

    //     if(action.type === 'mute' || action.type === 'unmute') {
    //         _.throttle(onMuteOrUnmuteCallback, 500)(action.type, action.payload);
    //     }
    // }
    
    onExtraDataUpdatedCallback(e);
}