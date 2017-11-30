import React, { Component } from 'react';
import { ComponentLogging, logDOMError } from '../service/log';
import _ from 'lodash';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Button, ButtonToolbar, ButtonGroup, FormGroup, ControlLabel, DropdownButton, MenuItem, Form } from 'react-bootstrap';
import Rnd from 'react-rnd';
import { setInterval } from 'timers';

let c;
const VIDEO_WIDTH_FACTOR = 0.63;
const VIDEO_HEIGHT_FACTOR = 0.4;

class Monitor extends Component {
      constructor(props) {
            super(props);

            c = new ComponentLogging('Monitor');

            this.rtc = props.rtcSession;
            this.connection = this.rtc.connection;
            c.log(props); 
            
            this.state = {
                  showCopyMonitorIdIcon: false,
                  width: window.innerWidth * VIDEO_WIDTH_FACTOR,
                  height: window.innerHeight * VIDEO_HEIGHT_FACTOR,
            }; // state will lose after tab switched

            c.log('List of available resolutions: ', props.resolutions);
            c.log('Default resolution: ', props.resolution);
      }

      componentDidMount() {   
            c.log('mounted, session, ', this.rtc);
            c.log('Connection of this session, ', this.connection);

            if(this.props.sessionType === 'broadcast') {
                  let int = setInterval(()=> {
                        if(this.refs.video) {
                              this.refs.video.volume = 0; // Avoid making noise for broadcaster on start  
                              clearInterval(int);  
                        }                                            
                  }, 10);
            }

            window.addEventListener('resize', this._onWindowResize.bind(this));

            // this.rtc.onExtraDataUpdatedCallback = this._onExtraDataUpdate.bind(this);
            this.connection.onExtraDataUpdated = this._onExtraDataUpdate.bind(this);
      }

      componentWillReceiveProps(nextProps) {
            this._onProps({ ...nextProps });
      }

      componentWillUnmount() {
            c.log('will unmount');
            window.removeEventListener('resize', this._onWindowResize);
      }

      render() {
            const { resolution, remoteConstraints:rC, minFrameRate, maxFrameRate } = this.props;
            // c.log(resolution, minFrameRate, maxFrameRate);

            const isChrome = this.connection.DetectRTC.browser.name === 'Chrome';
            const isBroadcast = this.connection.isInitiator || this.props.sessionType === 'broadcast';
            let remoteResolution;
            let remoteMinFrameRate;
            let remoteMaxFrameRate;

            if( !_.isEmpty(rC) && _.isObject(rC.video) ){ // Video Constraints
                  const remoteWidth = isChrome? rC.video.mandatory.maxWidth : rC.video.width;
                  const remoteHeight = isChrome? rC.video.mandatory.maxHeight : rC.video.height;
                  remoteResolution = _.find(this.props.resolutions, { width: remoteWidth, height: remoteHeight });

                  const remoteMinFps = isChrome? rC.video.mandatory.minFrameRate : rC.video.frameRate.min;
                  const remoteMaxFps = isChrome? rC.video.mandatory.maxFrameRate : rC.video.frameRate.max;
                  remoteMinFrameRate = _.find(this.props.frameRates, { fps: remoteMinFps });
                  remoteMaxFrameRate = _.find(this.props.frameRates, { fps: remoteMaxFps });
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
                                                <h5>Minimum FPS: &nbsp;&nbsp;{ `${remoteMinFrameRate.name} - ${remoteMinFrameRate.fps}` }</h5> 
                                          }
                                          { 
                                                (remoteMaxFrameRate && this.props.sessionType === 'view') && 
                                                <h5>Maximum FPS: &nbsp;&nbsp;{ `${remoteMaxFrameRate.name} - ${remoteMaxFrameRate.fps}` }</h5> 
                                          }
                                    </div>
                                    <div className='Monitor__config-container'>
                                          <FormGroup>
                                                <ButtonToolbar>
                                                      {<Button onClick={this._onRefresh.bind(this)}>
                                                            { isBroadcast? 'Refresh':'Re-join' } Connection &nbsp;<i className="fa fa-refresh fa-2x Monitor__refresh-icon"></i>
                                                      </Button>}
                                                      {<Button onClick={this._onRestart.bind(this)}>
                                                            { isBroadcast? 'Restart':'Restart New Viewing' } Session &nbsp;<i className="fa fa-circle-o-notch fa-2x Monitor__restart-icon"></i>
                                                      </Button>}
                                                </ButtonToolbar>
                                          </FormGroup>
                                          {
                                                (resolution) &&
                                                <FormGroup>
                                                      <ControlLabel>Resolutions: &nbsp;</ControlLabel>
                                                      <DropdownButton bsStyle={'default'} id={'resolutions'} 
                                                            title={`${resolution.name} - ${resolution.width} x ${resolution.height}`} 
                                                            onSelect={this._onSelectResolution.bind(this)}
                                                      >
                                                            {(()=> this.props.resolutions.map((res, index) => (
                                                                  <MenuItem eventKey={res.name} key={index}>
                                                                        { this.props.resolution.name === res.name && <b>{res.name} - {res.width} x {res.height}</b> } 
                                                                        { this.props.resolution.name !== res.name && `${res.name} - ${res.width} x ${res.height}` }
                                                                  </MenuItem>
                                                            )))()}
                                                      </DropdownButton>
                                                </FormGroup>
                                          }
                                          { this._renderSelectFrameRates('min', isBroadcast, remoteMinFrameRate) }
                                          { this._renderSelectFrameRates('max', isBroadcast, remoteMaxFrameRate) }
                                    </div>
                              </div>
                              <div className='Monitor__video-col col-md-8'>
                                    <div 
                                          className='row'
                                          { ... isBroadcast? {} : {style: { minHeight: this.state.height }} }
                                    >
                                          {     (!!isBroadcast || window.innerWidth < 760) &&
                                                this._renderVideo('Monitor__video broadcast')
                                          }
                                          {     
                                                (! isBroadcast && window.innerWidth >= 760) &&
                                                <Rnd  
                                                      className="Monitor__draggable-container"
                                                      size={{ width: this.state.width,  height: this.state.height }}
                                                      position={{ x: 0, y: 0 }}
                                                      onResize={(e, direction, ref, delta, position) => {
                                                            this.setState({
                                                                  width: ref.offsetWidth,
                                                                  height: ref.offsetHeight,
                                                            });
                                                      }}
                                                      minWidth={200}
                                                      minHeight={100}
                                                      maxWidth={window.innerWidth * VIDEO_WIDTH_FACTOR}
                                                      disableDragging
                                                      // lockAspectRatio
                                                >
                                                      { this._renderVideo('Monitor__video') }
                                                </Rnd>
                                          }
                                    </div>
                                    <div className='row'>
                                          {  (()=>{
                                                      this.audioMuteBtnClassName = this.props.muteStreamAudio?'fa fa-volume-up fa-2x': 'fa fa-volume-off fa-2x';
                                                      this.videoMuteBtnClassName = this.props.muteStreamVideo?'fa fa-play fa-2x': "fa fa-pause fa-2x";
                                                })() 
                                          }
                                          {    
                                                <ButtonGroup>
                                                      <Button onClick={this._onMuteRemote.bind(this, 'audio', this.props.muteStreamAudio)} active={this.props.muteStreamAudio}>
                                                      {this.props.muteStreamAudio? 'Unmute':'Mute'} Broadcast Audio &nbsp;&nbsp;<i className={ this.audioMuteBtnClassName } ></i></Button>
                                                      <Button onClick={this._onMuteRemote.bind(this, 'video', this.props.muteStreamVideo)} active={this.props.muteStreamVideo}>
                                                      {this.props.muteStreamVideo? 'Unmute':'Mute'} Broadcast Video &nbsp;&nbsp;<i className={ this.videoMuteBtnClassName }></i></Button>
                                                </ButtonGroup>
                                          }
                                          {
                                                ! isBroadcast && 
                                                <h4>Remote Stream: &nbsp; Audio muted: <b>{ `${this.props.remoteStreamAudioMuted}` }</b>, VIDEO muted: <b>{ `${this.props.remoteStreamVideoMuted}` }</b></h4>
                                          }
                                          {
                                                // <p>(Bug: cannot mute/unmute (streamEvents not containing stream) after refresh connection)</p>
                                          }
                                    </div>
                              </div>
                        </div>
                  </div>
            );
      }

      _renderVideo(className) {
            return (
                  <video 
                        ref={'video'} 
                        id="video"
                        // src={ this.props.src || '' }
                        controls
                        autoPlay
                        loop
                        className={`${className}`}
                        muted={this.props.muted}
                        onVolumeChange={this._onVolumeChange.bind(this)}
                  />
            )
      }

      _renderSelectFrameRates(mode = 'min', isBroadcast = false, remoteFrameRate) {
            const title = mode === 'min'? 'Minimum': 'Maximum';
            const frameRate = this.props[`${mode}FrameRate`];

            return (
                  <FormGroup>
                        <ControlLabel>{title} FPS: &nbsp;</ControlLabel>
                        <DropdownButton bsStyle={'default'} id={`${mode}FrameRateSelect`} 
                              title={`${frameRate.name} - ${frameRate.fps}`} 
                              onSelect={ (evtKey, e) => this._onSelectFrameRate(mode, evtKey, e) }
                        >
                              {(()=> this.props.frameRates.map((fr, index) => (
                                    <MenuItem eventKey={fr.name} key={index}>
                                          { frameRate.name === fr.name && <b>{fr.name} - {fr.fps}</b> } 
                                          { frameRate.name !== fr.name && `${fr.name} - ${fr.fps}` }
                                    </MenuItem>
                              )))()}
                        </DropdownButton>
                  </FormGroup>
            );
      }

      _onWindowResize(e) {
            const width = e.target.innerWidth;

            if(this.state.width > width * VIDEO_WIDTH_FACTOR) {
                  this.setState({ 
                        width: width * VIDEO_WIDTH_FACTOR,
                        height: width * VIDEO_HEIGHT_FACTOR,
                  })
            }

            this.forceUpdate();
      }
      
      _onRefresh() {
            this.refs.video.pause();
            const errCallback = (err)=>this.props.toast && this.props.toast('Error: cannot refresh Connection', {
                  type: 'error',
                  autoClose: 5000
            });

            if( ! this.connection.isInitiator || this.props.sessionType === 'view' ) {
                  c.log('Refresh as a viewer');
                  this.rtc.userEventHandlers.rejoinConnection(errCallback);
                  return;
            };
            c.log('Refresh as a broadcaster');
            this.rtc.userEventHandlers.refreshConnection(errCallback);
            this.props.updateTabConfig({ muteStreamVideo: false, muteStreamAudio: false });
      }

      _onRestart() {
            let newMonitorId;
            this.refs.video.pause();
            const errCallback = (err)=>this.props.toast && this.props.toast('Error: cannot rejoin Connection', {
                  type: 'error',
                  autoClose: 5000
            });
            
            if( !this.connection.isInitiator || this.props.sessionType === 'view' ) {
                  this.props.openModal();
                  let newTitle = this.props.onViewerRestart(null, true).title || 'new Session';   
                  let newMonitorId = this.props.onViewerRestart(null, true).monitorId;   
                  this.props.updateTabConfig({ monitorId: newMonitorId, title: newTitle });

                  if(!newMonitorId) 
                        return this.props.toast('Please enter a new monitor ID to view!!', { type: 'error', autoClose: 5000 });
            };

            this.rtc.userEventHandlers.leave();
            this.props.restartSession(newMonitorId);
            this.connection = null;
      }

      _onVolumeChange() {
            if( 
                  (!this.props.muted && this.refs.video.volume === 0 ) ||
                  (this.props.muted && this.refs.video.volume !== 0 ) 
            ) {
                  if(this.refs.video.volume === 0) this.props.updateTabConfig({ muted: true }) && (this.refs.video.muted = true);
                  else this.props.updateTabConfig({ muted: false }) && (this.refs.video.muted = false);
                  c.log('Mute audio locally: ', this.refs.video.muted);
                  
                  this.props.toast && this.props.toast(`${ this.refs.video.volume === 0? 'Mute': 'Unmute' } audio locally.`, {
                        type: 'info',
                        autoClose: 2000,
                  });

                  if(! this.connection.isInitiator || this.props.sessionType === 'view') {
                        c.log('Mute stream by viewer');
                        this.connection && this.rtc.userEventHandlers.muteOrUnmuteStream( this.refs.video.volume === 0, 'audio', (err)=>{
                              this.props.toast && this.props.toast('Error: Cannot mute or unmute audio', {
                                    type: 'error',
                                    autoClose: 7000
                              })
                        });
                  }
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
                  // this.props.updateTabConfig({ muted: true });
            }
            if(nextProps.remoteConstraints && !_.isEqual(nextProps.remoteConstraints, this.props.remoteConstraints)) {
                  this.props.updateTabConfig({ remoteConstraints: nextProps.remoteConstraints });
                  c.log('props update remote constraints: ', nextProps.remoteConstraints);
            };
            if(nextProps.muted !== this.props.muted) {
                  c.log('Receive local muted: ', nextProps.muted);
                  this.refs.video.muted = nextProps.muted;
            };
      }

      _onCopy() {
            const msg = 'Copied : '+this.props.monitorId + ' !!';
            c.log(msg);
            this.props.toast && this.props.toast(msg, {
                  type: 'info',
                  autoClose: 3000
            });
      }

      _onSelectResolution(eventKey, e) {
            c.log('Selected resolution: '+ eventKey);
            this.refs.video.pause();
            let resolution = _.find(this.props.resolutions, { name: eventKey });
            this.props.updateTabConfig({ resolution, muteStreamVideo: false, muteStreamAudio: false });                

            if(! this.connection.isInitiator || this.props.sessionType === 'view') {
                  c.log('Request to update resolution');
                  this.connection.extra.action = { type: 'updateResolution', payload: eventKey };
                  this.connection.updateExtraData();
                  return;
            };

            this.rtc.userEventHandlers.applyConstraints(
                  { width: resolution.width, height: resolution.height }, 
                  ()=>this.props.toast && this.props.toast('Error: Cannot update Resolution or this resolution is not supported.', {
                        type: 'error',
                        autoClose: 5000
                  })
            );
      }

      _onSelectFrameRate(mode='min', eventKey, e) {
            c.log('Selected '+mode+' frame rate: '+ eventKey);
            this.refs.video.pause();
            let constraints = {}, state = {};

            let selectedframeRate = _.find(this.props.frameRates, { name: eventKey });
            constraints[`${mode}FrameRate`] = selectedframeRate.fps;
            state[`${mode}FrameRate`] = selectedframeRate;

            this.props.updateTabConfig({ ...state, muteStreamVideo: false, muteStreamAudio: false });              

            if(! this.connection.isInitiator || this.props.sessionType === 'view') {
                  c.log('Request to update frameRate');
                  this.connection.extra.action = { type: 'updateFrameRate', payload: { mode, eventKey } };
                  this.connection.updateExtraData();
                  return;
            };

            this.rtc.userEventHandlers.applyConstraints(
                  constraints, 
                  ()=>this.props.toast && this.props.toast('Error: Cannot update Frame Rate or this Frame Rate is not supported.', {
                        type: 'error',
                        autoClose: 5000
                  })
            );
      }

      _onMuteRemote(type, currentMuteState) {
            c.log('Mute broadcast stream type: '+type, this.refs.video.srcObject);
            let nextMuteState = ! currentMuteState;
            if(type === 'video') {
                  this.props.updateTabConfig({ muteStreamVideo: nextMuteState, });
            } else {
                  this.props.updateTabConfig({ muteStreamAudio: nextMuteState, });
            };

            if(! this.connection.isInitiator || this.props.sessionType === 'view') {
                  c.log('Request to nextMuteState/Unmute remote');
                  this.connection.extra.action = { type: 'muteOrUnmute', payload: { type, currentMuteState } };
                  this.connection.updateExtraData();
                  return;
            };


            this.connection && this.rtc.userEventHandlers.muteOrUnmuteStream(nextMuteState, type, (err)=>{
                  this.props.toast && this.props.toast('Error: Cannot nextMuteState or unmute stream '+type, {
                        type: 'error',
                        autoClose: 7000
                  })
            }, this.refs.video.srcObject);
      }

      _onExtraDataUpdate(e) {
            const userId = e.userid;
            const extra = { ...e.extra };
            c.log('_onExtraDataUpdate', e);
            const isChrome = this.connection.DetectRTC.browser.name === 'Chrome';

            if(!extra) return;

            if(extra.action) {
                  let action = extra.action;
                  switch (action.type) {
                        case 'updateResolution':
                              if(this.connection.isInitiator) {
                                    let msg = 'the remote viewer has requested to update resolution';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onSelectResolution(action.payload);
                              };
                              break;
                        case 'updateFrameRate':
                              if(this.connection.isInitiator) {
                                    let msg = 'the remote viewer has requested to update resolution';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onSelectFrameRate(action.payload.mode, action.payload.eventKey);
                              };
                              break;
                        case 'muteOrUnmute': 
                              if(this.connection.isInitiator) {
                                    let msg = 'the remote viewer has requested to mute or unmute stream';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onMuteRemote(action.payload.type, action.payload.currentMuteState);
                              };
                              break;
                        default:
                              break;
                  }
            }

            if(extra.muted &&  (!this.connection.isInitiator || this.props.sessionType !== 'broadcast')) {
                  let message;
                  if( !_.isEqual(extra.muted.video, this.props.remoteStreamVideoMuted) ) {
                        let remoteStreamVideoMuted;
                        let muteStreamVideo = remoteStreamVideoMuted = extra.muted.video;
                        this.props.updateTabConfig({ remoteStreamVideoMuted, muteStreamVideo });
                        message = `Remote broadcaster ${extra.muted.video? 'muted' : 'unmuted'} video.`
                  }
                  if( !_.isEqual(extra.muted.audio, this.props.remoteStreamAudioMuted) ) {
                        let remoteStreamAudioMuted;
                        let muteStreamAudio = remoteStreamAudioMuted = extra.muted.audio;
                        this.props.updateTabConfig({ remoteStreamAudioMuted, muteStreamAudio });
                        message = `Remote broadcaster ${extra.muted.audio? 'muted' : 'unmuted'} audio.`
                  }
                  this.props.toast(message, { type: 'info', autoClose: 3000 });
            };

            if(extra.constraints && (!this.connection.isInitiator || this.props.sessionType !== 'broadcast')) {
                  if( !_.isEqual(extra.constraints, this.props.remoteConstraints)) {
                        c.log('**Extra update remote constraints: ', extra.constraints);
                        const eC = extra.constraints;
                        const rC = { ...this.props.remoteConstraints };
                        this.props.updateTabConfig({ remoteConstraints: extra.constraints });                      

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
                                    let newRes = _.find(this.props.resolutions, { width: newWidth, height: newHeight });
                                    this.props.toast && this.props.toast(`Remote resolution is changed to ${newRes.name} - ${newWidth}x${newHeight} at ${this.props.title}`, {
                                          type: 'info',
                                          autoClose: 4000,
                                    });
                              };
                              if(+oldMinFps !== +newMinFps || +oldMaxFps !== +newMaxFps) {
                                    let newMin = _.find(this.props.frameRates, { fps: +newMinFps });
                                    let newMax = _.find(this.props.frameRates, { fps: +newMaxFps });
                                    this.props.toast && this.props.toast(`Remote frame rate is changed ! Min: ${newMin.fps}, Max: ${newMax.fps} at ${this.props.title}`, {
                                          type: 'info',
                                          autoClose: 4000,
                                    });
                              };
                        }
                  };
            };
      };
}

export default Monitor;

