import React, { Component } from 'react';
import SocketService from '../service/socket';
import LogService from '../service/log';
import WebRTCService from '../service/webrtc';  

class ViewMonitor extends Component {
      constructor(props) {
            super(props);

            this.socket = null;
            this.state = {
                  room: SocketService.Constants.defaultRoom,
                  src: null,
            };
      }

      componentDidMount() {   
            LogService.logComponentEvent('ViewMonitor mounted');
            
            this.socket = SocketService.startSocketConnection();
      }

      componentWillUnmount() {
            LogService.logComponentEvent('ViewMonitor will unmount');
      }

      render() {
            return (
                  <div>
                        <div>
                              View Monitor
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
}

export default ViewMonitor;