import io from 'socket.io-client';
import LogService from './log';

var socket;

export const Constants = {
    endpoint: 'http://localhost:3000',
    defaultRoom: 'default_room'
};
/**
 * Start a new socket connection if no socket is connected for this web client.
 * Return the exisiting socket connection if there has been a connection.
*/
export const startSocketConnection = () => {
    if (!socket) {
        socket = io(Constants.endpoint);

        socket.on('connect', () => {
            LogService.logSocketEvent('connected socket');
        });

        socket.on('connected', (data) => {
            LogService.logSocketEvent(data.message);
        });

        socket.on('connect_error', (error) => {
            LogService.logSocketEvent(error);
        });

        socket.on('error', (error) => {
            LogService.logSocketEvent(error);
        });
    };

    return socket;
}

export const getSocket = () => socket;

export const onSignal = (user_type, command, handler = () => {}) => {
    socket.on('signal', (data) => {
        if (data.user_type === user_type && data.command === command) {
            handler();
        };
    });
}

export default {
    Constants,
    startSocketConnection,
    getSocket,
    onSignal
};