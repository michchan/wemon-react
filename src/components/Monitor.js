import React, { Component } from 'react';
import { ComponentLogging } from '../service/log';
import _ from 'lodash';

let c;

class Monitor extends Component {
      constructor(props) {
            super(props);

            c = new ComponentLogging('Monitor');

            this.rtc = props.rtcSession;
            this.connection = this.rtc.connection;
      }

      componentDidMount() {   
            c.log('mounted');
            // c.log('role: '+this.props.match.params.role);
            // c.log('id: '+this.props.match.params.id);
            c.log('video ref: ', this.refs.video);

            // set video ref for RTC to bind stream src
            this.rtc.refs.video = this.refs.video;

            c.log('connection, ', this.connection);
            _.forEach(this.connection, (val, key)=>{
                  if(typeof val === 'function')
                        c.log(key);
            });
      }

      componentWillReceiveProps(nextProps) {
            if(nextProps.rtcSession !== this.props.rtcSession) this.rtc = nextProps.rtcSession;
            if(nextProps.socketIsReady !== this.props.socketIsReady) {
                  c.log('socketIsReady changed, ', nextProps.socketIsReady);
                  // Join or Open a monitor
                  this.rtc.userEventHandlers.openOrJoin(this.props.id);
            };
      }

      componentWillUnmount() {
            c.log('will unmount');
      }

      render() {
            return (
                  <div className="Monitor-container">
                        <div>
                              <h1>{ this.props.title }</h1>
                              <h3>{ `Type: ${this.props.sessionType}` }</h3>
                              <h5>{ `User ID: ${this.connection.userid}` }</h5>
                              <h3>{ `Monitor ID: ${this.props.id}` }</h3>
                        </div>
                        <div>
                              <video 
                                    ref="video" 
                                    src={ this.props.src || '' }
                                    controls
                                    muted
                                    autoPlay/>
                        </div>
                  </div>
            );
      }
}

export default Monitor;