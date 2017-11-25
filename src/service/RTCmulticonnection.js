import io from 'socket.io-client';
import _ from 'lodash';

import { 
    logRTCMultiConnectionEvent as log, 
    logRTCMultiConnectionError as logErr,
    logRTCMultiConnectionSocketEvent as logSocket,
    logErrorEvent,
} from './log';

window.io = io; // RTCMultiConnection need to access the io class

var RTCMultiConnection = window.RTCMultiConnection; // the class

export default class RTCMultiConnectionSession {

    constructor(sessionId, connectedSocketCallback=()=>{}, onStreamCallback=()=>{}) {
        if(!RTCMultiConnection) return log('RTCMultiConnection undefined');

        this.connection = new RTCMultiConnection(sessionId);
        
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
        _setSocketConnection(this.connection, connectedSocketCallback);
        _setConnectionEventHandler(this.connection, this.userEventHandlers, this.refs, this.buffer, onStreamCallback);
    
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

const _setConnectionEventHandler = (connection, userEventHandlers, refs, buffer, onStreamCallback = ()=>{}) => {
    let handlers = _getConnectionEventHandlers(connection, refs, buffer, onStreamCallback);

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

const _getConnectionEventHandlers = (connection, refs, buffer, onStreamCallback) => ({

    onStream: (event) => {
        log('onStream', event, refs.video, event.stream);

        if (connection.isInitiator && event.type !== 'local') {
            return;
        };

        if(!refs.video) return logErr('onStream: No video Ref');

        connection.isUpperUserLeft = false;

        connection.isUpperUserLeft = false;
        // refs.video.srcObject = event.stream;
        const videoSrc = URL.createObjectURL(event.stream)
        refs.video.src = videoSrc;
        onStreamCallback(videoSrc); // callback for setState src

        refs.video.play();

        refs.video.userid = event.userid;

        if (event.type === 'local') {
            refs.video.muted = true;
        }

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

    onStreamEnded: (e)=>{
        log(connection.userid + ' receive onStreamEnded ');
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
        log(connection.userid + ' received entire session closed');
    },

    onExtraDataUpdated: function(e) {
        log(connection.userid + ' received extra data updated', e.userid, e.extra);
        
        const { closed, type, peers } = e.extra;
        let isToMe = false;

        if(peers)
            peers.map(peerId => isToMe = peerId === connection.userid);

        if(closed && isToMe) {
            if(type === 'broadcast') {
                onStreamCallback('');
            };
            if(type === 'view') {
                onStreamCallback('');
            };
        };
    },

    onleave: (e) => {
        log(connection.userid + ' received sb leave');
    },

    onclose: (e) => {
        log(connection.userid + ' received sb close');
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
    
    leave: (type) => {
        // let peers = [];
        // log(connection.userid + ' all participants: ', connection.getAllParticipants());
        // connection.getAllParticipants().forEach(function(remoteUserId) {
        //     // var user = connection.peers[remoteUserId];
        //     // log('leaving user\'s extra', remoteUserId, user.extra);
        //     // peers.push(remoteUserId);
        //     connection.peers[remoteUserId].peer.close();
        //     // log(connection.peers[remoteUserId].peer);
        // });

        // connection.extra = {
        //     type,
        //     peers,
        //     closed: true,
        // };
        // connection.updateExtraData();
        if(type === 'broadcast') {
            connection.close();
        };
        if(type === 'view') {
            connection.leave();
        }

        // connection.attachStreams.forEach(function(stream) {
        //     stream.stop();
        // });

        // connection = null;
        
        log('Removed session and disconnect with all peers on leave');
    }

});