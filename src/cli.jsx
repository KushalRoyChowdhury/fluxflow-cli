#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './app.jsx';

// Clear terminal on start for a clean slate
process.stdout.write('\x1Bc');

render(<App />);
