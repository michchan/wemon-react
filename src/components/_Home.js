import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import rtc from '../service/RTCmulticonnection';

class Home extends Component {
    constructor(props) {
        super(props);

        this.state = {
            initialized: false,
            monitorId: '',
        };

        rtc.initService();  
    }

    componentDidMount() {
        rtc.setRefs({
            broadcastIdRef: this.refs.monitorId
        });
    }

    render() {
        return (
            <div className='container-fluid container-full'>
                <div className='row no-gutters'>
                    <div className='Home-input-container'>
                        Enter Monitor ID:&nbsp;&nbsp;
                        <input 
                            ref='monitorId' 
                            type='text' 
                            value={ this.state.monitorId }
                            onChange={ (e)=>this.setState({ monitorId: e.target.value })  }
                        />
                    </div>
                </div>
                <div className='row no-gutters'>
                    <Link to={`/monitor/create/${this.state.monitorId}`} className='col-md-6 Home-grid-button Home-grid-button-left'>
                        Create Monitor
                    </Link>
                    <Link to={`/monitor/view/${this.state.monitorId}`}  className='col-md-6 Home-grid-button Home-grid-button-right'>
                        View Monitor
                    </Link>
                </div>
            </div>
        );
    }

    _getProps() {
        return {
            autoResponsive: {
                containerWidth: 200,
                itemMargin: 0,
                gridWidth: 100
            },
        };
    }
}

export default Home;