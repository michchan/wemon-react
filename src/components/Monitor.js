import React, { Component } from 'react';
import { ComponentLogging, logDOMError } from '../service/log';
import _ from 'lodash';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Button, ButtonToolbar, ButtonGroup, FormGroup, ControlLabel, DropdownButton, MenuItem, Form } from 'react-bootstrap';
import Rnd from 'react-rnd';
import { setInterval, clearInterval } from 'timers';
import moment from 'moment';

let c;
const VIDEO_WIDTH_FACTOR = 0.63;
const VIDEO_HEIGHT_FACTOR = 0.4;
var RecordRTC = window.RecordRTC;
var MediaStreamRecorder = window.MediaStreamRecorder;
var JSZip = window.JSZip;
var MediaStreamTrack = window.MediaStreamTrack;

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
                  trackingOn: false,
                  recordingOn: false,
                  motionDetectOn: false,
                  cameras: [],
                  camera: null,
            }; // state will lose after tab switched

            c.log('List of available resolutions: ', props.resolutions);
            c.log('Default resolution: ', props.resolution);

            this.lastExtra = null;
            this.lastAction = null;
            this.lastConstraints = null;
            this.lastMuted = null;
            this.lastRes = null;
            this.lastFrameRate = null;
      }

      componentWillMount() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                  console.error("enumerateDevices() not supported.");
                  return;
            }

            navigator.mediaDevices.enumerateDevices()
            .then(this._getCameras.bind(this))
            .catch(function(err) {
                  console.error(err.name + ": " + err.message);
            });
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
                                          {
                                                (isBroadcast && this.state.camera) && 
                                                <FormGroup>
                                                      <ControlLabel>Select Camera: &nbsp;</ControlLabel>
                                                      <DropdownButton bsStyle={'default'} id={'cameras'} 
                                                            title={`${this.state.camera.text}`} 
                                                            onSelect={this._onSelectCamera.bind(this)}
                                                      >
                                                            {(()=> this.state.cameras.map((camera, index) => (
                                                                  <MenuItem eventKey={camera.value} key={index}>
                                                                        { camera.text }
                                                                  </MenuItem>
                                                            )))()}
                                                      </DropdownButton>
                                                </FormGroup>
                                          }
                                          <FormGroup>
                                                <ButtonToolbar>
                                                      {     
                                                            ! isBroadcast &&
                                                            <Button onClick={this._onRefreshRemote.bind(this)}>
                                                                  Refresh Remote Connection &nbsp;<i className="fa fa-refresh fa-2x Monitor__refresh-icon"></i>
                                                            </Button>
                                                      }     
                                                      {<Button onClick={this._onRefresh.bind(this)}>
                                                            { isBroadcast? 'Refresh':'Re-join' } Connection &nbsp;<i className="fa fa-refresh fa-2x Monitor__refresh-icon"></i>
                                                      </Button>
                                                      }
                                                      {
                                                            isBroadcast && 
                                                            <Button onClick={this._onRestart.bind(this)}>
                                                                  Restart Session &nbsp;<i className="fa fa-circle-o-notch fa-2x Monitor__restart-icon"></i>
                                                            </Button>
                                                      }
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
                                          <FormGroup>
                                                <ButtonToolbar>
                                                      {/* <Button onClick={this._onSwitchMotionDetection.bind(this)} active={this.state.motionDetectOn}>
                                                            { this.state.motionDetectOn? 'Stop Motion Detection':'Start Motion Detection' } 
                                                      </Button> */}
                                                      <Button onClick={this._onSwitchRecording.bind(this, this.state.recordingOn)} active={this.state.recordingOn}>
                                                            { this.state.recordingOn? 'Stop':'Start' } {isBroadcast? '':'Remote'} Recording
                                                      </Button>
                                                      <Button onClick={this._takeSnapshot.bind(this)}>
                                                            Take Snapshot
                                                      </Button>
                                                      {
                                                            !!isBroadcast &&
                                                            <Button onClick={this._downloadAllRecordings.bind(this)}>
                                                                  Download All Recordings
                                                            </Button>
                                                      }
                                                </ButtonToolbar>
                                          </FormGroup>
                                          { 
                                                this.rtc.buffer.recordings.length > 0 && 
                                                <FormGroup>
                                                      <ControlLabel>Recorded videos: </ControlLabel>
                                                      {
                                                            (()=>this.rtc.buffer.recordings.map(recording=>(
                                                                  <p key={recording.time}><a onClick={this._downloadRecording.bind(this, recording)}>{recording.time}</a></p>
                                                            )))()
                                                      }
                                                </FormGroup>
                                          }
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
                                          <canvas ref='canvas' id='canvas'/>
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

      _getCameras(devices) {
            devices.forEach((device) => {
                  console.log(device.kind + ": " + device.label + " id = " + device.deviceId);

                  let option = {}, cameras = [ ...this.state.cameras ];
                  if (device.kind === 'videoinput') {
                        option.value = device.deviceId;                        
                        option.text = device.label || 'camera ' + (this.state.cameras.length + 1);

                        cameras.push(option);
                        this.setState({ cameras });
                  }
            });
            
            this.setState({ camera: this.state.cameras[0] });
      }

      _downloadRecording(recording) {
            download(URL.createObjectURL(recording.blob), recording.fileName);
      }

      _downloadAllRecordings() {            
            if( this.rtc.buffer.recordings.length === 0 ) {
                  this.props.toast('No recorded videos.', { type:'error', autoClose: 3000 });
                  return;
            }
            
            c.log('Download single recording');
            if(this.rtc.buffer.recordings.length === 1) {
                  let recording = this.rtc.buffer.recordings[0];
                  download(URL.createObjectURL(recording.blob), recording.fileName);
                  return;
            }

            let zip = new JSZip();
            c.log('Download all recordings as zip');            
            this.rtc.buffer.recordings.map(recording => {
                  zip.file(recording.fileName, recording.blob, {base64: true});
            });

            zip.generateAsync({type:"blob"})
            .then(function(content) {
                  // see FileSaver.js
                  download(URL.createObjectURL(content), "wemon-recordings.zip");
            });
      }

      _onSwitchRecording(recordingState) {
            let recorder;

            if(! this.connection.isInitiator) {
                  this.connection.extra.action = { type: 'requestRecording', payload: recordingState };
                  this.connection.updateExtraData();
                  return;
            } else {
                  this.connection.extra.action = { type: 'updateRecording', payload: ! recordingState };
                  this.connection.updateExtraData();                  
            }

            if(typeof RecordRTC !== 'function') return this.props.toast('Cannot start/stop recording due to some errors', {type:'error', autoClose:5000});

            if(recordingState && this.rtc.recorder) {
                  // stop recording
                  recorder = this.rtc.recorder;
                  recorder.stopRecording(()=>{
                        const time = moment().format('YYYY-MM-DD-HH.mm.ss');
                        const fileName = `wemon-recording_${time}.mp4`;
                        let blob = recorder.getBlob();
                        // download( URL.createObjectURL(blob), `wemon-recording_${moment().format('YYYY-MM-DD-HH.mm.ss')}.mp4`);
                        this.rtc.buffer.recordings.push({ blob, time, fileName });
                        this.props.toast('Recording stored in the buffer!', { type: 'info', autoClose: 3000 });
                  });

                  this.setState({ recordingOn: false });
                  return;
            };

            // start recording
            let stream = this.connection.streamEvents[this.connection.latestStreamId].stream;

            if(!stream) logDOMError('No stream found');

            recorder = RecordRTC(stream, {
                  type: 'video',
                  recorderType: MediaStreamRecorder
            });

            recorder.startRecording();

            this.rtc.recorder = recorder;

            this.setState({ recordingOn: true });
      }

      _onSwitchMotionDetection() {

      }

      _takeSnapshot() {
            let canvas = this.refs.canvas;
            let context = canvas.getContext('2d');
            let video = this.refs.video;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

            var blob = canvas.toDataURL('image/png');
            download(blob, `wemon-snapshot_${moment().format('YYYY-MM-DD-HH.mm.ss')}.png`);
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

      _onRefreshRemote() {
            this.connection.extra.action = { type: 'requestRefresh', payload: {} };
            this.connection.updateExtraData();
      }
      
      _onRefresh(stop = true) {
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

            if(!stop) {
                  let count = 0;
                  let int = setInterval(()=>{ 
                        if(count===2) {
                              clearInterval(int);
                              return this._onRefresh();
                        }
                        this._onRefresh();
                        count++;
                  }, 1000);
            }
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

      _onSelectCamera(cameraId, e) {
            // if(this.state.camera.value !== cameraId) {
                  let camera = _.find(this.state.cameras, { value: cameraId });
                  this.setState({ camera });

                  if(! this.connection.isInitiator || this.props.sessionType === 'view') return;

                  this.rtc.userEventHandlers.applyConstraints(
                        { deviceId: cameraId }, 
                        ()=>this.props.toast && this.props.toast('Error: Cannot update Camera or this camera is not supported.', {
                              type: 'error',
                              autoClose: 5000
                        })
                  );
            // }
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
                  this.props.toast && this.props.toast('Error: Cannot mute or unmute stream '+type, {
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

            if(!extra || _.isEqual(extra, this.lastExtra)) return;

            this.lastExtra = extra;

            if(extra.action && !_.isEqual(extra.action, this.lastAction)) {
                  let action = extra.action, msg = '';
                  this.lastAction = action;

                  if(this.connection.isInitiator) {
                        switch (action.type) {
                              case 'requestRefresh':
                                    msg = 'The remote viewer has requested to refresh stream';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onRefresh(false);
                                    break;
                              case 'updateResolution':
                                    msg = 'The remote viewer has requested to update resolution';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onSelectResolution(action.payload);
                                    break;
                              case 'updateFrameRate':
                                    msg = 'The remote viewer has requested to update resolution';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onSelectFrameRate(action.payload.mode, action.payload.eventKey);
                                    break;
                              case 'muteOrUnmute': 
                                    msg = 'The remote viewer has requested to mute or unmute stream';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onMuteRemote(action.payload.type, action.payload.currentMuteState);
                                    break;
                              case 'requestRecording':
                                    msg = 'The remote viewer has requested to start/stop recording';
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this._onSwitchRecording(action.payload);
                                    break;
                              default:
                                    break;
                        }
                  } else { // forward action
                        // this.connection.extra.action = action;
                        // this.connection.updateExtraData();
                        switch (action.type) {
                              case 'updateRecording':
                                    msg = `The broadcaster has ${action.payload? 'started': 'stopped'} recording`;
                                    c.log(msg);
                                    this.props.toast(msg, { type:'info', autoClose: 3000 });
                                    this.setState({ recordingOn: action.payload });
                                    break;
                              default:
                                    break;
                        }
                  }
            }

            if(extra.muted && (!this.connection.isInitiator || this.props.sessionType !== 'broadcast') && !_.isEqual(extra.muted, this.lastMuted)) {
                  this.lastMuted = extra.muted;

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

            if(extra.constraints && (!this.connection.isInitiator || this.props.sessionType !== 'broadcast') && !_.isEqual(extra.constraints, this.lastConstraints)) {
                  this.lastConstraints = extra.constraints;

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
      
                              let newRes = _.find(this.props.resolutions, { width: newWidth, height: newHeight });
                              let newMin = _.find(this.props.frameRates, { fps: +newMinFps });
                              let newMax = _.find(this.props.frameRates, { fps: +newMaxFps });                       

                              if( !_.isEqual(newRes, this.lastRes) && (oldWidth !== newWidth || oldHeight !== newHeight)) {
                                    this.props.toast && this.props.toast(`Remote resolution is changed to ${newRes.name} - ${newWidth}x${newHeight} at ${this.props.title}`, {
                                          type: 'info',
                                          autoClose: 4000,
                                    });
                                    this.props.updateTabConfig({ resolution: newRes }); 
                                    this.lastRes = newRes;
                              };
                              if( !_.isEqual({ min: newMin, max: newMax }, this.lastFrameRate) && (+oldMinFps !== +newMinFps || +oldMaxFps !== +newMaxFps)) {
                                    this.props.toast && this.props.toast(`Remote frame rate is changed ! Min: ${newMin.fps}, Max: ${newMax.fps} at ${this.props.title}`, {
                                          type: 'info',
                                          autoClose: 4000,
                                    });
                                    this.props.updateTabConfig({ minFrameRate: newMin, maxFrameRate: newMax }); 
                                    this.lastFrameRate = { min: newMin, max: newMax };
                              };
                        }
                  };
            };
      };
}

export default Monitor;

function download(dataurl, filename) {
      var a = document.createElement("a");
      a.href = dataurl;
      a.setAttribute("download", filename);
      var b = document.createEvent("MouseEvents");
      b.initEvent("click", false, true);
      a.dispatchEvent(b);

      return false;
}

