import React, {Component} from 'react';
import './App.css';
import {BrowserRouter, Route, Switch, Link} from 'react-router-dom';

import rtc from './service/RTCmulticonnection';
import 'rtcmulticonnection-v3/dist/RTCMultiConnection.min.js';

import CreateMonitor from './components/CreateMonitor';
import ViewMonitor from './components/ViewMonitor';
import Home from './components/Home';

class App extends Component {
  componentWillMount() {
    rtc.initService();
  }

  render() {
    return (
      <BrowserRouter>
        <div className="App">

          <header className="App-header">
            <Link to={'/'} className="App-header__link">
              <i className="fa fa-4x fa-desktop" aria-hidden="true"></i>
              <h1 className="App-title">WeMon - The monitor app</h1>
            </Link>
          </header>

          <Switch>
            <Route exact path='/' component={Home}/>
            <Route path='/create-monitor' component={CreateMonitor}/>
            <Route path='/view-monitor' component={ViewMonitor}/>
          </Switch>

        </div>
      </BrowserRouter>
    );
  }
}

export default App;
