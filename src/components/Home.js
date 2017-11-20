import React, { Component } from 'react';
import { Link } from 'react-router-dom';

class Home extends Component {
    render() {
        return (
            <div>
                Home
                <div>
                    <Link to={'/create-monitor'}>
                        Create Monitor
                    </Link>
                </div>
                <div>
                    <Link to={'/view-monitor'}>
                        View Monitor
                    </Link>
                </div>
            </div>
        );
    }
}

export default Home;