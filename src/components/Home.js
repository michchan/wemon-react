import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import _ from 'lodash';
import { ToastContainer, toast } from 'react-toastify';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'elemental';
import { Form, FormControl, FormGroup, ControlLabel, HelpBlock, ToggleButtonGroup, ToggleButton } from 'react-bootstrap';
import {
    ChasingDots,
    Circle,
    CubeGrid,
    DoubleBounce,
    FadingCircle,
    FoldingCube,
    Pulse,
    RotatingPlane,
    ThreeBounce,
    WanderingCubes,
    Wave
} from 'better-react-spinkit';

import Monitor from './Monitor';

import { ComponentLogging } from '../service/log';
import RTCService from '../service/RTCmulticonnection';
import { global } from 'core-js/library/web/timers';

var c;

const formProps = {
    sessionName: 'sessionName',
    sessionId: 'sessionId',
};

class Home extends Component {
    constructor(props) {
        super(props);

        c = new ComponentLogging('Home');

        this.state = {
            initialized: false,
            monitorId: '',
            tabIndex: 0,
            tabs: [],
            isModalOpen: false,
            form: this._getInitialFormState(),
            createSessionType: 'broadcast', // default is broadcast
            disabledButton: false,
        };

        this.isRemovingTab = false; // it needs immediate blocking so not using state
    }

    componentWillMount() { 
        window.addEventListener('dblclick', this._closeModal.bind(this));
    }

    componentDidMount() {
        this._autoFocusButtons(this.state);
    }

    componentWillUnmount() {
        window.removeEventListener('dblclick', this._closeModal.bind(this));
    }

    componentWillUpdate(nextProps, nextState) {
        this._autoFocusButtons(nextState);
    }

    render() {
        return (
            <div className='container-fluid container-full'>
                <div className='row no-gutters'>
                    { this._renderBody() }
                    { this._renderCreateSessionModal() }
                    { <ToastContainer/> }
                </div>
            </div>
        );
    }

    _renderBody() {
        if(this.state.tabs.length === 0) 
            return this._renderEmpty();

        return this._renderTabsBody();
    }

    _renderTabsBody() {
        // c.log('Tabs: ', this.state.tabs);
        // c.log('CurrentTabIndex: ', this.state.tabIndex);
        // c.log('CurrentTab: ', this.state.tabs[this.state.tabIndex]);

        return (
            <Tabs 
                selectedIndex={ this.state.tabIndex } 
                onSelect={ this._onSelectTab.bind(this) }
                forceRenderTabPanel
            >
                <TabList>
                    { this._renderTabs() }
                    <button onClick={ this._onCreateSessionClick.bind(this) } className='Home-tabs__plus-button'>+</button>
                </TabList>
                { this._renderTabPanels() }
            </Tabs>
        );
    }

    _renderTabs() {
        return this.state.tabs.map((tabConfig, index) => {
            const isBroadcast = tabConfig.sessionType === 'broadcast';

            return(
                <Tab key={index}>
                    { isBroadcast && <span><i className="fa fa-video-camera" aria-hidden="true" color='red'></i>&nbsp;&nbsp;</span> }
                    { tabConfig.title }
                    { tabConfig.loading && <span className='tab__loading'><FadingCircle size={25} color="#AEAEAE"/></span>}
                    <button onClick={ ()=>this._onRemoveSessionClick(index, tabConfig) } className='Home-tabs__cross-button'> &#x2715; </button>
                </Tab>
            );
        });
    }

    _renderTabPanels() {
        return this.state.tabs.map((tabConfig, index) => (
            <TabPanel key={index}>
                <div>
                    {
                        tabConfig.loading && 
                        <div className='tab-panel__loading'>
                            <FadingCircle size={60}  color="white"/>
                        </div>
                    }
                    <Monitor { ...tabConfig } toast={toast}/>
                </div>
            </TabPanel>
        ));
    }

    _renderEmpty() {
        return (
            <div>
                <div className='row no-gutters Home-empty-info-container'>
                    Click "Create Monitor Session" to create or view monitor.
                </div>
                <div className='row no-gutters'>
                    <button 
                        ref={'createSessionButton'}
                        type="button" 
                        autoFocus
                        className="btn btn-primary btn-lg"
                        onClick={ this._onCreateSessionClick.bind(this) }
                    >
                        Create Monitor Session
                    </button>
                </div>
            </div>
        )
    }

    _renderCreateSessionModal() {
        return (
            <Modal 
                isOpen={this.state.isModalOpen} 
                onCancel={ this._closeModal.bind(this) } 
                backdropClosesModal
            >
                <ModalHeader 
                    text="Create New Monitor Session" 
                    showCloseButton 
                    onClose={this._closeModal.bind(this)}/>
                <ModalBody>
                    { this._renderCreateSessionForm() }
                </ModalBody>
                <ModalFooter>
                    <Button type="primary" onClick={this._onModalConfirm.bind(this)}>Confirm</Button>
                    <Button type="link-cancel" onClick={this._closeModal.bind(this)}>Cancel</Button>
                </ModalFooter>
            </Modal>
        );
    }

    _renderCreateSessionForm() {
        const { form, createSessionType } = this.state;
        const isBroadcast = createSessionType === 'broadcast';

        return (
            <Form>
                {
                    /* ToggleButton for createSessionType */
                    <FormGroup>
                        <ToggleButtonGroup
                            type="radio"
                            name="createSessionType"
                            value={ this.state.createSessionType }
                            onChange={ (createSessionType)=>{ this.setState({ createSessionType })} }
                        >
                            <ToggleButton value={'broadcast'}>Broadcast A Monitor</ToggleButton>
                            <ToggleButton value={'view'}>View A Monitor</ToggleButton>
                        </ToggleButtonGroup>
                    </FormGroup>
                }
                {
                    /* session name */
                    <FormGroup
                        controlId="formSessionName"
                        validationState={ form.sessionName.validation }
                    >
                        <ControlLabel>Monitor Session Name: </ControlLabel>
                        <FormControl
                            type="text"
                            value={ form.sessionName.value }
                            placeholder="Enter whatever you want to name this monitor..."
                            onChange={e => this._onFormChange(e, formProps.sessionName)}
                        />
                        <FormControl.Feedback />
                        { (form.sessionName.validation && form.sessionName.validationMessage) && <HelpBlock>{ form.sessionName.validationMessage }</HelpBlock> }
                    </FormGroup>
                }
                {
                    /* view-only: session id */
                    !isBroadcast && 
                    <FormGroup
                        controlId="formSessionId"
                        validationState={ form.sessionId.validation }
                    >
                        <ControlLabel>*Monitor Session Id: </ControlLabel>
                        <FormControl
                            type="text"
                            value={ form.sessionId.value }
                            placeholder="Enter the universal id of monitor you want to view..."
                            onChange={e => this._onFormChange(e, formProps.sessionId)}
                        />
                        <FormControl.Feedback />
                        { (form.sessionId.validation && form.sessionId.validationMessage) && <HelpBlock>{ form.sessionId.validationMessage }</HelpBlock> }
                    </FormGroup>
                }
            </Form>
        );
    }

    _autoFocusButtons(state, e) {
        if(state.tabs.length === 0) {
            return this.refs.createSessionButton && this.refs.createSessionButton.focus();
        };
    }

    _getInitialFormState() {
        return {
            sessionName: {
                value: '',
                validation: null,
                validationMessage: null,
            },
            sessionId: {
                value: '',
                validation: null,
                validationMessage: null,
            },
        };
    }

    _onFormChange(e, propName) {
        const value = e.target.value;
        const form = { ...this.state.form };

        form[propName].value = value;

        //form-validation
        const validation = this._getValidationState(propName);
        form[propName].validation = validation.status;
        form[propName].validationMessage = validation.message;

        this.setState({ form });
    }

    _getValidationState(propName) {
        const value = this.state.form[propName].value;
        const length = value.length;

        if( propName === formProps.sessionName ) {
            if (length > 0) return {
                status: 'success',
                message: null,
            };
            else return {
                status: 'warning',
                message: 'Please enter something.',
            };;
            return null;
        };

        if( propName === formProps.sessionId ) {
            if (length > 10) return {
                status: 'success',
                message: null,
            };
            else return {
                status: 'error',
                message: 'Please enter an unique ID with at least 10 digits.',
            };;
            return null;
        };
    }

    _onModalConfirm() {
        c.log('Form values: ', this.state.form);
        const { form, createSessionType } = this.state;
        let _form;
        let allValid = true;
        let title = _.isEmpty(form.sessionName.value)? 'Unnamed Monitor Session' : form.sessionName.value; // auto fill title
        
        // Filter fields to check by type
        if(createSessionType === 'broadcast') {
            _form = {
                sessionName: form.sessionName,
            };
        };
        if(createSessionType === 'view') {
            _form = {
                sessionName: form.sessionName,
                sessionId: form.sessionId
            };
        };

        // Check fields validation
        _.forEach(_form, (field, key) => {
            this._onFormChange({ target: { value: field.value } }, key);            
        });
        _.forEach(_form, (field, key) => {
            if(field.validation === 'error') {
                allValid = false;
            }
        });
        
        if(!allValid) return; // return if any field is invalid

        let tabs = [ ...this.state.tabs ];
        const thisIndex = tabs.length;
        let sessionId = generateRandomString();

        let rtcSession = new RTCService( 
            ()=> this._updateTabConfig(sessionId, { socketIsReady: true }),
            (e, constraints)=> this._onStream(e, sessionId, constraints),
            (e, receiverId)=> this._onSessionClosed(e, receiverId, sessionId),
        );

        let monitorId;
        if(createSessionType === 'broadcast') {
            monitorId = rtcSession.connection.token();
        };
        if(createSessionType === 'view') {
            monitorId = form.sessionId.value;
        };

        let tabConfig = {
            title,
            id: sessionId,
            monitorId,
            broadcasterId: null, // receive from stream
            sessionType: createSessionType,
            rtcSession,
            updateTabConfig: (config)=>this._updateTabConfig(sessionId, config),            
            socketIsReady: false,
            srcObject: null,
            loading: true,
            restartSession: ()=>{},
            muted: createSessionType === 'broadcast'? true : false,
            resolutions: rtcSession.userEventHandlers.getResolutions() || [],
            frameRates: rtcSession.userEventHandlers.getFrameRates() || [],
            resolution: createSessionType === 'view'? null : rtcSession.userEventHandlers.getDefaultResolution(),            
            minFrameRate: createSessionType === 'view'? null : rtcSession.userEventHandlers.getDefaultMinFrameRate(),
            maxFrameRate: createSessionType === 'view'? null : rtcSession.userEventHandlers.getDefaultMaxFrameRate(),
            remoteConstraints: {},
        };
        tabConfig.restartSession = (monitorId)=>this._restartSession(sessionId, tabConfig, monitorId);

        this._createTab(tabConfig);
        this._closeModal();
    }

    _restartSession(sessionId, _tabConfig, monitorId) {
        let tabConfig = { ..._tabConfig };
        this._updateTabConfig(sessionId, tabConfig);   

        tabConfig.rtcSession = new RTCService( 
            ()=> this._updateTabConfig(sessionId, { socketIsReady: true }),
            (e, constraints)=> this._onStream(e, sessionId, constraints),
            (e, receiverId)=> this._onSessionClosed(e, receiverId, sessionId),
        );

        if(tabConfig.sessionType === 'broadcast') {
            tabConfig.monitorId = tabConfig.rtcSession.connection.token();
        } else { // if the viewer has provide a new monitorId
            if(monitorId) tabConfig.monitorId = monitorId;
            // if not, use the old one
        }
        c.log('Restart session with tabConfig: ', tabConfig);

        this._updateTabConfig(sessionId, tabConfig);        
    }

    _onStream(e, id, constraints) {
        const { stream, userid, type } = e;
        
        // c.log(userid+' receives on Stream. src: ', URL.createObjectURL(stream));

        this._updateTabConfig(id, { 
            srcObject: stream,
            // src: URL.createObjectURL(stream),
            broadcasterId: userid,
            streamType: type,
            loading: false,
            remoteConstraints: constraints,
        });
    }

    _onSessionClosed(e, receiverId,id) {
        c.log(receiverId + ': session is closed by: '+e.userid);

        let closedIndex = _.findIndex(this.state.tabs, { id });

        this.setState({ tabIndex: closedIndex }, ()=> setTimeout(()=>{
            let tabConfig = _.find(this.state.tabs, { id });
            tabConfig && toast('Monitor stream id: '+e.userid+' is closed or restarted by remote user', { type: 'error', autoClose: 6000 });
        }, 0));
    }

    _updateTabConfig(id, config) {
        c.log('update tab config, id: '+id, config);

        let tabs = this.state.tabs.map((tabConfig, index) => {
            if(tabConfig.id === id)
                return { ...tabConfig, ...config };
            return tabConfig;
        });
        this.setState({ tabs });
    }

    _closeModal() {
        this.state.isModalOpen && this.setState({ 
            isModalOpen: !this.state.isModalOpen,
            form: this._getInitialFormState(), //clear form state
        });
    }

    _onSelectTab(tabIndex) {
        if( !this.isRemovingTab ) {
            // c.log('onSelect Session: '+tabIndex);
            this.setState({ tabIndex });
        };
    }

    _onCreateSessionClick(e) {
        this.setState({ isModalOpen: true });

        // this._createTab();
    }

    _onRemoveSessionClick(index, tab) {
        this.isRemovingTab = true; // Set this to prevent simultaneous 'onSelect' event

        tab.rtcSession.userEventHandlers.leave(tab.sessionType); //wrapper of connection.leave

        this._removeTab(index, ()=>this.isRemovingTab = false );
    }

    _createTab(configs) {
        let tabs = [ ...this.state.tabs ];
        const tabIndex = tabs.length;

        tabs.push(configs);

        this.setState({ 
            tabs,
            tabIndex
        });
    }

    _removeTab(index, finishCallback = ()=>{}) {
        const { tabs: lastTabs, tabIndex: lastTabIndex } = this.state;

        let tabs = [ ...lastTabs ];
        let tabIndex = lastTabIndex === 0? lastTabIndex : lastTabIndex - 1;

        if( index > lastTabIndex ) {
            // If closing the tab after current tab
            tabIndex = lastTabIndex;
        };

        c.log('onRemoveSession: '+index + ', next tabIndex: '+tabIndex);
        
        tabs.splice(index, 1); // remove the item with 'index'
        this.setState({ tabs, tabIndex }, finishCallback);
    }
}

export default Home;


// functions 

const generateRandomString = () => Math.random().toString(36).substr(2, 14);