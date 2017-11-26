import React, { Component } from 'react';
import { ComponentLogging, logDOMError } from '../service/log';
import _ from 'lodash';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { ToastContainer, toast } from 'react-toastify';
import { Button, ButtonToolbar, ButtonGroup, FormGroup, ControlLabel, DropdownButton, MenuItem, Form } from 'react-bootstrap';

let c;

class Monitor extends Component {
      constructor(props) {
            super(props);

            c = new ComponentLogging('Monitor');

            this.rtc = props.rtcSession;
            this.connection = this.rtc.connection;
            c.log(props); 
            
            this.state = {
                  muted: props.sessionType === 'broadcast'? true : false,
                  showCopyMonitorIdIcon: false,
                  resolutions: this.rtc.userEventHandlers.getResolutions() || [],
                  resolution: this.rtc.userEventHandlers.getDefaultResolution(),
                  remoteConstraints: {},
            };

            c.log('List of available resolutions: ', this.state.resolutions);
            c.log('Default resolution: ', this.state.resolution);
      }

      componentDidMount() {   
            c.log('mounted, session, ', this.rtc);
            c.log('Connection of this session, ', this.connection);

            if(this.props.sessionType === 'broadcast') this.refs.video.volume = 0; // Avoid making noise for broadcaster on start

            this.rtc.setExtraDataUpdateHandler(this._onExtraDataUpdate.bind(this))
      }

      componentWillReceiveProps(nextProps) {
            this._onProps({ ...nextProps });
      }

      componentWillUnmount() {
            c.log('will unmount');
      }

      render() {
            const { resolution, remoteConstraints: rC } = this.state;
            const isChrome = this.connection.DetectRTC.browser.name === 'Chrome';
            const isBroadcast = this.connection.isInitiator || this.props.sessionType === 'broadcast';
            let remoteResolution;

            if( !_.isEmpty(rC) ){
                  const remoteWidth = isChrome? rC.video.mandatory.maxWidth : rC.video.width;
                  const remoteHeight = isChrome? rC.video.mandatory.maxHeight : rC.video.height;
                  remoteResolution = _.find(this.state.resolutions, { width: remoteWidth, height: remoteHeight });
            }

            return (
                  <div className="Monitor-container">
                        <div className='row'>
                              <div className='col-md-4'>
                                    <div className='Monitor__info-container'>
                                          <h2 className='no-top-margin'>{ this.props.title }</h2><br/>
                                          <CopyToClipboard
                                                text={this.props.monitorId}
                                                onCopy={this._onCopy.bind(this)}
                                          >
                                                <button 
                                                      className='Monitor__monitor-id-btn no-background no-border'
                                                      onMouseOver={ ()=>this.setState({ showCopyMonitorIdIcon: true }) }
                                                      onMouseLeave={ ()=>this.setState({ showCopyMonitorIdIcon: false }) }
                                                >
                                                      <h4 className='no-margin'>
                                                            Monitor ID: &nbsp;&nbsp;<span ref='monitorId'>{ `${ this.props.monitorId || this.props.broadcasterId }` }</span>
                                                            &nbsp;&nbsp;<i className="fa fa-clone fa-align-left" hidden={ !this.state.showCopyMonitorIdIcon }></i>
                                                      </h4>
                                                </button>
                                          </CopyToClipboard>
                                          <h5>Session type: &nbsp;&nbsp;<b>{ `${this.props.sessionType}` }</b></h5>
                                          <h5>Connection User ID: &nbsp;&nbsp;{ this.connection && `${this.connection.userid}` }</h5>
                                          { 
                                                (remoteResolution && this.props.sessionType === 'view') && 
                                                <h5>Resolution: &nbsp;&nbsp;{ `${remoteResolution.name} - ${remoteResolution.width} x ${remoteResolution.height}` }</h5> 
                                          }
                                    </div>
                                    <div className='Monitor__config-container'>
                                          <FormGroup>
                                                <ButtonToolbar>
                                                      <Button onClick={this._onRefresh.bind(this)}>Refresh Connection &nbsp;<i className="fa fa-refresh"></i></Button>
                                                      <Button onClick={this._onRestart.bind(this)}>Restart Session &nbsp;<i className="fa fa-circle-o-notch"></i></Button>
                                                </ButtonToolbar>
                                          </FormGroup>
                                          {
                                                isBroadcast &&
                                                <FormGroup>
                                                      <ControlLabel>Resolutions: &nbsp;</ControlLabel>
                                                      <DropdownButton bsStyle={'default'} id={'resolutions'} 
                                                            title={`${resolution.name} - ${resolution.width} x ${resolution.height}`} 
                                                            onSelect={this._onSelectResolution.bind(this)}
                                                      >
                                                            {(()=> this.state.resolutions.map((res, index) => (
                                                                  <MenuItem eventKey={res.name} key={index}>
                                                                        { this.state.resolution.name === res.name && <b>{res.name} - {res.width} x {res.height}</b> } 
                                                                        { this.state.resolution.name !== res.name && `${res.name} - ${res.width} x ${res.height}` }
                                                                  </MenuItem>
                                                            )))()}
                                                      </DropdownButton>
                                                </FormGroup>
                                          }
                                    </div>
                              </div>
                              <div className='Monitor__video-col col-md-8'>
                                    <video 
                                          ref="video" 
                                          // src={ this.props.src || '' }
                                          controls
                                          className='Monitor__video'
                                          muted={this.state.muted}
                                          onVolumeChange={this._onVolumeChange.bind(this)}
                                    />
                              </div>
                        </div>
                  </div>
            );
      }
      
      _onRefresh() {
            this.refs.video.pause();

            if( !this.connection.isInitiator || this.props.sessionType === 'view' ) {
                  this.rtc.userEventHandlers.leave(true);
                  this.rtc.userEventHandlers.openOrJoin(this.props.monitorId);
                  return;
            };
            this.rtc.userEventHandlers.refreshConnection((err)=>this.props.toast && this.props.toast('Error: cannot refresh Connection', {
                  type: 'error',
                  autoClose: 5000
            }));
      }

      _onRestart() {
            let newMonitorId;
            this.refs.video.pause();
            
            if( !this.connection.isInitiator || this.props.sessionType === 'view' ) {
                  newMonitorId = prompt('New Session Id: ', `${this.props.monitorId}`);
            };
            this.rtc.userEventHandlers.leave();
            this.props.restartSession(newMonitorId);
            this.connection = null;
      }

      _onVolumeChange() {
            if( 
                  (!this.state.muted && this.refs.video.volume === 0 ) ||
                  (this.state.muted && this.refs.video.volume !== 0 ) 
            ) {
                  this.connection && this.rtc.userEventHandlers.muteOrUnmuteStream( this.refs.video.volume === 0, (err)=>{
                        this.props.toast && this.props.toast('Error: Cannot mute or unmute stream', {
                              type: 'error',
                              autoClose: 7000
                        })
                  });

                  if(this.refs.video.volume === 0) this.setState({ muted: true });
                  else this.setState({ muted: false });
            }
      }

      _onProps(nextProps) {
            if( !_.isEqual(nextProps.rtcSession, this.props.rtcSession)) {
                  this.rtc = nextProps.rtcSession;
                  this.connection = nextProps.rtcSession.connection;
            };
            if(nextProps.socketIsReady !== this.props.socketIsReady) {
                  c.log('socketIsReady changed, ', nextProps.socketIsReady);
                  // Join or Open a monitor
                  this.connection && this.rtc.userEventHandlers.openOrJoin(this.props.monitorId);
            };
            if(nextProps.srcObject && !_.isEqual(nextProps.srcObject, this.props.srcObject)) {
                  let video = this.refs.video;
                  video.pause();
                  video.srcObject = nextProps.srcObject;
                  video.play();
            };
            if(nextProps.streamType && nextProps.streamType === 'local') {
                  this.setState({ muted: true });
            }
            if(nextProps.remoteConstraints && !_.isEqual(nextProps.remoteConstraints, this.state.remoteConstraints)) {
                  this.setState({ remoteConstraints: nextProps.remoteConstraints });
            };
      }

      _onCopy() {
            const msg = 'Copied! : '+this.props.monitorId;
            c.log(msg);
            this.props.toast && this.props.toast(msg, {
                  type: 'info',
                  autoClose: 5000
            });
      }

      _onSelectResolution(eventKey, e) {
            c.log('Selected resolution: '+ eventKey);
            this.refs.video.pause();
            let resolution = _.find(this.state.resolutions, { name: eventKey });
            this.rtc.userEventHandlers.applyConstraints(
                  { width: resolution.width, height: resolution.height }, 
                  ()=>this.props.toast && this.props.toast('Error: Update Resolution or this resolution is not supported.', {
                        type: 'error',
                        autoClose: 7000
                  })
            );
            this.setState({ resolution });            
      }

      _onExtraDataUpdate(e) {
            const userId = e.userid;
            const extra = e.extra;
            const isChrome = this.connection.DetectRTC.browser.name === 'Chrome';

            if(extra.constraints && (!this.connection.isInitiator || this.props.sessionType !== 'broadcast')) {
                  if( !_.isEqual(extra.constraints, this.state.remoteConstraints)) {
                        const eC = extra.constraints;
                        const rC = { ...this.state.remoteConstraints };
                        this.setState({ remoteConstraints: extra.constraints });                      

                        if( !_.isEmpty(rC) ) {
                              const oldWidth = isChrome? rC.video.mandatory.maxWidth : rC.video.width;
                              const oldHeight = isChrome? rC.video.mandatory.maxHeight : rC.video.height;
                              const newWidth = isChrome? eC.video.mandatory.maxWidth : eC.video.width;
                              const newHeight = isChrome? eC.video.mandatory.maxHeight : eC.video.height;
      
                              if(oldWidth !== newWidth || oldHeight !== newHeight) {
                                    this.props.toast && toast(`Remote resolution is changed by ${userId}(user ID) to ${newWidth} x ${newHeight}`, {
                                          type: 'info',
                                          autoClose: 5000,
                                    });
                              };
                        }
                  };
            };
      };
}

export default Monitor;

