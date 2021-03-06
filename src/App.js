import React, {Component} from 'react';
import './App.css';
import {BrowserRouter, Route, Switch, Link} from 'react-router-dom';

import Monitor from './components/Monitor';
import Home from './components/Home';

const packageConfigs = require('../package.json');

class App extends Component {
  componentWillMount() {
    if(!packageConfigs.dev) {
      console.log = function(){};
    };
  }

  render() {
    return (
      <BrowserRouter>
        <div className="App">

          <header className="App-header">
            <Link to={'/'} className="App-header__link">
              <i className="fa fa-4x fa-desktop" aria-hidden="true"></i>
              <h1 className="App-title">WeMon - The monitor app</h1>
              <p className='App-version'>Version: { packageConfigs.version }</p>
            </Link>
          </header>

          <Switch>
            <Route exact path='/' component={Home}/>
            {/* <Route path='/monitor/:role/:id' component={Monitor}/> */}
          </Switch>
        </div>
      </BrowserRouter>
    );
  }
}

export default App;
