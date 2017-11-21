import React, { Component } from 'react';
import { ComponentLogging } from '../service/log';

import rtc from '../service/RTCmulticonnection';

let c;

class Monitor extends Component {
      constructor(props) {
            super(props);

            c = new ComponentLogging('Monitor');

            this.socket = null;
            this.state = {
                  src: null,
            };
      }

      componentDidMount() {   
            c.log('mounted');
            c.log('role: '+this.props.match.params.role);
            c.log('id: '+this.props.match.params.id);
            c.log('video ref: ', this.refs.video);

            rtc.setRefs({
                  videoRef: this.refs.video,
            });

            // Join or Open a monitor
            rtc.getComponentEventHandlers().onOpenOrJoin(this.props.match.params.id);
      }

      componentWillUnmount() {
            c.log('will unmount');
      }

      render() {
            return (
                  <div className="Monitor-container">
                        <div>
                              Monitor
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

export default Monitor;