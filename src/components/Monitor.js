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

            this.state = {
                  muted: props.sessionType === 'broadcast'? true : false,
            }
      }

      componentDidMount() {   
            c.log('mounted');
            c.log('Connection of this session, ', this.connection);
      }

      componentWillReceiveProps(nextProps) {
            this._onProps({ ...nextProps });
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
                              <h5>{ `Broadcaster ID: ${this.props.broadcasterId}` }</h5>
                              <h3>{ `Monitor ID: ${this.props.monitorId}` }</h3>
                        </div>
                        <div>
                              <video 
                                    ref="video" 
                                    src={ this.props.src || '' }
                                    controls
                                    className='Monitor__video'
                                    muted={this.state.muted}
                                    autoPlay
                                    onVolumeChange={this._onVolumeChange.bind(this)}
                              />
                        </div>
                  </div>
            );
      }
      
      _onVolumeChange() {
            if( 
                  (!this.state.muted && this.refs.video.volume === 0 ) ||
                  (this.state.muted && this.refs.video.volume !== 0 ) 
            ) {
                  this.rtc.userEventHandlers.muteOrUnmuteStream( this.refs.video.volume === 0 );
                  
                  if(this.refs.video.volume === 0) this.setState({ muted: true });
                  else this.setState({ muted: false });            
            }
      }

      _onProps(nextProps) {
            if(nextProps.rtcSession !== this.props.rtcSession) this.rtc = nextProps.rtcSession;
            if(nextProps.socketIsReady !== this.props.socketIsReady) {
                  c.log('socketIsReady changed, ', nextProps.socketIsReady);
                  // Join or Open a monitor
                  this.rtc.userEventHandlers.openOrJoin(this.props.monitorId);
            };
            if(nextProps.srcObject && nextProps.srcObject !== this.props.srcObject) {
                  this.refs.video.srcObject = nextProps.srcObject;
                  this.refs.video.play();
            };
            if(nextProps.streamType && nextProps.streamType === 'local') {
                  this.setState({ muted: true });
            }
      }
}

export default Monitor;