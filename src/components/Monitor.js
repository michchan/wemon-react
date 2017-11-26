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
                  frameRates: this.rtc.userEventHandlers.getFrameRates() || [],
                  minFrameRate: this.rtc.userEventHandlers.getDefaultMinFrameRate(),
                  maxFrameRate: this.rtc.userEventHandlers.getDefaultMaxFrameRate(),
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
            const { resolution, remoteConstraints:rC, minFrameRate, maxFrameRate } = this.state;
            const isChrome = this.connection.DetectRTC.browser.name === 'Chrome';
            const isBroadcast = this.connection.isInitiator || this.props.sessionType === 'broadcast';
            let remoteResolution;
            let remoteMinFrameRate;
            let remoteMaxFrameRate;

            if( !_.isEmpty(rC) && _.isObject(rC.video) ){ // Video Constraints
                  const remoteWidth = isChrome? rC.video.mandatory.maxWidth : rC.video.width;
                  const remoteHeight = isChrome? rC.video.mandatory.maxHeight : rC.video.height;
                  remoteResolution = _.find(this.state.resolutions, { width: remoteWidth, height: remoteHeight });

                  const remoteMinFps = isChrome? rC.video.mandatory.minFrameRate : rC.video.frameRate.min;
                  const remoteMaxFps = isChrome? rC.video.mandatory.maxFrameRate : rC.video.frameRate.max;
                  remoteMinFrameRate = _.find(this.state.frameRates, { fps: remoteMinFps });
                  remoteMaxFrameRate = _.find(this.state.frameRates, { fps: remoteMaxFps });
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
                                          { 
                                                (remoteMinFrameRate && this.props.sessionType === 'view') && 
                                                <h5>Minimum Frame Rate: &nbsp;&nbsp;{ `${remoteMinFrameRate.name} - ${remoteMinFrameRate.fps}` }</h5> 
                                          }
                                          { 
                                                (remoteMaxFrameRate && this.props.sessionType === 'view') && 
                                                <h5>Maximum Frame Rate: &nbsp;&nbsp;{ `${remoteMaxFrameRate.name} - ${remoteMaxFrameRate.fps}` }</h5> 
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
                                          { this._renderSelectFrameRates('min', isBroadcast) }
                                          { this._renderSelectFrameRates('max', isBroadcast) }
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

      _renderSelectFrameRates(mode = 'min', isBroadcast = false) {
            const title = mode === 'min'? 'Minimum': 'Maximum';
            const frameRate = this.state[`${mode}FrameRate`];

            if(isBroadcast)
                  return (
                        <FormGroup>
                              <ControlLabel>{title} Frame Rate (fps): &nbsp;</ControlLabel>
                              <DropdownButton bsStyle={'default'} id={`${mode}FrameRateSelect`} 
                                    title={`${frameRate.name} - ${frameRate.fps}`} 
                                    onSelect={ (evtKey, e) => this._onSelectFrameRate(mode, evtKey, e) }
                              >
                                    {(()=> this.state.frameRates.map((fr, index) => (
                                          <MenuItem eventKey={fr.name} key={index}>
                                                { frameRate.name === fr.name && <b>{fr.name} - {fr.fps}</b> } 
                                                { frameRate.name !== fr.name && `${fr.name} - ${fr.fps}` }
                                          </MenuItem>
                                    )))()}
                              </DropdownButton>
                        </FormGroup>
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
                  c.log('props update remote constraints: ', nextProps.remoteConstraints);
            };
      }

      _onCopy() {
            const msg = 'Copied : '+this.props.monitorId + ' !!';
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
                  ()=>this.props.toast && this.props.toast('Error: Cannot update Resolution or this resolution is not supported.', {
                        type: 'error',
                        autoClose: 5000
                  })
            );
            this.setState({ resolution });         
      }

      _onSelectFrameRate(mode='min', eventKey, e) {
            c.log('Selected '+mode+' frame rate: '+ eventKey);
            this.refs.video.pause();
            let constraints = {}, state = {};

            let selectedframeRate = _.find(this.state.frameRates, { name: eventKey });
            constraints[`${mode}FrameRate`] = selectedframeRate.fps;
            state[`${mode}FrameRate`] = selectedframeRate;

            this.rtc.userEventHandlers.applyConstraints(
                  constraints, 
                  ()=>this.props.toast && this.props.toast('Error: Cannot update Frame Rate or this Frame Rate is not supported.', {
                        type: 'error',
                        autoClose: 5000
                  })
            );
            this.setState({ ...state }); 
      }


      _onExtraDataUpdate(e) {
            const userId = e.userid;
            const extra = e.extra;
            const isChrome = this.connection.DetectRTC.browser.name === 'Chrome';

            if(extra.constraints && (!this.connection.isInitiator || this.props.sessionType !== 'broadcast')) {
                  if( !_.isEqual(extra.constraints, this.state.remoteConstraints)) {
                        c.log('**Extra update remote constraints: ', extra.constraints);
                        const eC = extra.constraints;
                        const rC = { ...this.state.remoteConstraints };
                        this.setState({ remoteConstraints: extra.constraints });                      

                        if( (!_.isEmpty(rC) && _.isObject(rC.video)) && (!_.isEmpty(eC) && _.isObject(eC.video)) ) { // Video Constraints
                              const oldWidth = isChrome? rC.video.mandatory.maxWidth : rC.video.width;
                              const oldHeight = isChrome? rC.video.mandatory.maxHeight : rC.video.height;
                              const newWidth = isChrome? eC.video.mandatory.maxWidth : eC.video.width;
                              const newHeight = isChrome? eC.video.mandatory.maxHeight : eC.video.height;

                              const oldMinFps = isChrome? rC.video.mandatory.minFrameRate : rC.video.frameRate.min;
                              const oldMaxFps = isChrome? rC.video.mandatory.maxFrameRate : rC.video.frameRate.max;
                              const newMinFps = isChrome? eC.video.mandatory.minFrameRate : eC.video.frameRate.min;
                              const newMaxFps = isChrome? eC.video.mandatory.maxFrameRate : eC.video.frameRate.max;
      
                              if(oldWidth !== newWidth || oldHeight !== newHeight) {
                                    let newRes = _.find(this.state.resolutions, { width: newWidth, height: newHeight });
                                    this.props.toast && toast(`Remote resolution is changed to ${newRes.name} - ${newWidth}x${newHeight}`, {
                                          type: 'info',
                                          autoClose: 3000,
                                    });
                              };
                              if(+oldMinFps !== +newMinFps || +oldMaxFps !== +newMaxFps) {
                                    let newMin = _.find(this.state.frameRates, { fps: +newMinFps });
                                    let newMax = _.find(this.state.frameRates, { fps: +newMaxFps });
                                    this.props.toast && toast(`Remote frame rate is changed ! Min: ${newMin.fps}, Max: ${newMax.fps}`, {
                                          type: 'info',
                                          autoClose: 3000,
                                    });
                              };
                        }
                  };
            };
      };
}

export default Monitor;

