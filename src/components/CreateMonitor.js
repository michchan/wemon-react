import React, { Component } from 'react';
import SocketService from '../service/socket';
import LogService from '../service/log';
import WebRTCService from '../service/webrtc';

class CreateMonitor extends Component {
      constructor(props) {
            super(props);

            this.socket = null;
            this.state = {
                  room: SocketService.Constants.defaultRoom,
                  src: null,
            };
      }

      componentDidMount() {
            LogService.logComponentEvent('CreateMonitor mounted');

            this.socket = SocketService.startSocketConnection();

            // Get LocalStream
            WebRTCService.getLocalStream((stream)=> this.setState({ src: URL.createObjectURL(stream) }));
      }

      componentWillUnmount() {
            LogService.logComponentEvent('CreateMonitor will unmount');
      }

      render() {
            return (
                  <div>
                        <div>
                              Create Monitor
                        </div>
                        <div>
                              <video 
                                    ref="video" 
                                    src={ this.state.src }
                                    controls
                                    muted
                                    autoPlay/>
                        </div>
                  </div>
            );
      }

      _
}

export default CreateMonitor;